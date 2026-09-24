// Smart Alert builder (M7): alerts from TIDE's signals, on all three Nansen
// alert types. Every template returns the exact request before anything is
// created; creating is always the user's own click, on their own account
// (the key owner's, or a member's own key).
import { getDb } from '@/server/nansen/db';
import { callNansen } from '@/server/nansen/client';
import type { RequestContext } from '@/server/context';
import { rotationFronts } from '@/server/weather/queries';
import { followScope, readFollows } from '@/server/smart-money/desk';
import { detectAddress, addressKey } from '@/lib/address-family';
import { CreateAlertRequest, CommonTokenTransferAlertData, SmTokenFlowsAlertData, SmartContractCallAlertData, AlertChannel, UpdateAlertRequest, SmartAlertTimeWindow } from '@/types/nansen/smart-alerts';
import { TIDE_PREFIX, alertPrefixOf, listTideAlerts } from './alerts';
import { S_SmartMoneyChain } from '@/types/nansen/api.gen';
import type { Provenance } from '@/lib/provenance';
import { chainName, usd } from '@/lib/viz/format';

export const TEMPLATES = ['follow', 'front', 'chain-inflow', 'deployer', 'token-flows', 'wallets'] as const;
export type TemplateId = (typeof TEMPLATES)[number];

export interface TemplateInput {
  chain?: string;
  token?: string;
  /** Index into the current rotation fronts (owner view). */
  front?: number;
  /** USD threshold; each template has a default. */
  minUsd?: number;
  /** For "deployer" and "wallets". */
  addresses?: string[];
  window?: string;
}

export interface AlertDraft { request: CreateAlertRequest; provenance: Provenance; summary: string }

/** Chains the smart-money and transfer alerts can watch (Nansen's smart-money set). */
const ALERT_CHAINS = S_SmartMoneyChain.options.filter((c) => c !== 'all');
export const MAX_TIDE_ALERTS = 20;
const MAX_SUBJECTS = 20;

export type ChannelInput =
  | { type: 'telegram'; chatId: string }
  | { type: 'discord'; webhookUrl: string }
  | { type: 'slack'; webhookUrl: string }
  | { type: 'webhook'; webhookUrl: string; secret?: string };

/** Validated destination: TIDE never calls it; Nansen delivers to it. */
export function channelOf(c: ChannelInput): AlertChannel {
  if (c.type === 'telegram') {
    if (!/^-?\d{4,20}$/.test(c.chatId.trim())) throw new Error('A Telegram chat id is a number (group chats start with "-").');
    return AlertChannel.parse({ type: 'telegram', data: { chatId: c.chatId.trim() } });
  }
  const u = c.webhookUrl.trim();
  if (c.type === 'discord' && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(u)) throw new Error('A Discord webhook URL starts with https://discord.com/api/webhooks/.');
  if (c.type === 'slack' && !/^https:\/\/hooks\.slack\.com\//.test(u)) throw new Error('A Slack webhook URL starts with https://hooks.slack.com/.');
  if (c.type === 'webhook') {
    if (!/^https:\/\/[^\s/]+\.[^\s/]+/.test(u)) throw new Error('A webhook must be an https URL.');
    const secret = c.secret?.trim();
    if (secret && (secret.length < 16 || secret.length > 512)) throw new Error('A signing secret is 16–512 characters.');
    return AlertChannel.parse({ type: 'webhook', data: { webhookUrl: u, ...(secret ? { secret } : {}) } });
  }
  return AlertChannel.parse({ type: c.type, data: { webhookUrl: u } });
}

const addresses = (xs: string[] | undefined) => [...new Set((xs ?? []).map((a) => a.trim()).filter((a) => detectAddress(a).length).map(addressKey))];

/** Default inflow threshold for a chain: the 90th percentile of recent positive
 *  hourly smart-money token net flows the scanner saw there, floored at $25K. */
export function chainInflowDefault(chain: string): number {
  const xs = (getDb().prepare(`SELECT netflow FROM token_pulse WHERE chain = ? AND window = '1h' AND source = 'smart-money' AND netflow > 0 AND snapshot_at > ?`).all(chain, Date.now() - 3 * 86_400_000) as Array<{ netflow: number }>).map((r) => r.netflow).sort((a, b) => a - b);
  const p90 = xs.length ? xs[Math.floor(0.9 * (xs.length - 1))] : 0;
  return Math.round(Math.max(25_000, p90) / 1000) * 1000;
}

function draft(name: string, type: CreateAlertRequest['type'], timeWindow: string, data: Record<string, unknown>, channel: AlertChannel, description: string, provenance: Omit<Provenance, 'calls'>): AlertDraft {
  const request = CreateAlertRequest.parse({ name: `${TIDE_PREFIX}${name}`, type, timeWindow: SmartAlertTimeWindow.parse(timeWindow), channels: [channel], data, description });
  return { request, summary: description, provenance: { ...provenance, calls: [{ endpoint: 'smart-alert', body: { ...request, channels: '<your channel>' } }] } };
}

export function planTemplate(ctx: RequestContext, template: TemplateId, input: TemplateInput, channel: AlertChannel): AlertDraft {
  const minUsd = (d: number) => Math.round(Math.min(50_000_000, Math.max(100, input.minUsd ?? d)));
  switch (template) {
    case 'follow': {
      const scope = followScope(ctx);
      const wallets = scope ? readFollows(scope).slice(0, MAX_SUBJECTS) : [];
      if (!wallets.length) throw new Error('Follow wallets on the smart-money desk first.');
      const min = minUsd(10_000);
      const data = CommonTokenTransferAlertData.parse({ chains: ALERT_CHAINS, subjects: wallets.map((value) => ({ type: 'address', value })), events: ['buy', 'sell', 'swap'], usdValue: { min } });
      return draft(`followed wallets trade (${wallets.length})`, 'common-token-transfer', 'realtime', data, channel,
        `Peregrine follow list: any of ${wallets.length} followed smart-money wallets buys, sells or swaps over ${usd(min)}.`,
        { title: 'Follow-list alert', formula: 'common-token-transfer, realtime: subjects = your followed wallets (up to 20); events buy, sell, swap; value ≥ threshold', inputs: [{ label: 'Wallets', value: String(wallets.length) }, { label: 'Threshold', value: usd(min) }], notes: ['Watches every chain in Nansen\'s smart-money set.'] });
    }
    case 'front': {
      if (ctx.mode !== 'owner') throw new Error('Capital rotations come from the scanner\'s smart-money trades, which only the key owner sees.');
      const fronts = rotationFronts(24);
      const f = fronts[input.front ?? 0];
      if (!f) throw new Error('No capital rotation in the last 24 hours.');
      const wallets = f.wallets.map((w) => w.wallet).slice(0, MAX_SUBJECTS);
      const min = minUsd(5_000);
      const data = CommonTokenTransferAlertData.parse({ chains: [f.to], subjects: wallets.map((value) => ({ type: 'address', value })), events: ['buy', 'swap'], usdValue: { min } });
      return draft(`rotation ${chainName(f.from)} → ${chainName(f.to)} wallets buying`, 'common-token-transfer', 'realtime', data, channel,
        `Peregrine capital rotation: one of the ${wallets.length} wallets that moved ${usd(f.netUsd)} from ${chainName(f.from)} into ${chainName(f.to)} buys over ${usd(min)} on ${chainName(f.to)}.`,
        { title: 'Capital-rotation alert', formula: 'common-token-transfer, realtime: subjects = the rotation\'s wallets; chain = its destination; events buy, swap; value ≥ threshold', inputs: [{ label: 'Front', value: `${chainName(f.from)} → ${chainName(f.to)} (${usd(f.netUsd)})` }, { label: 'Wallets', value: String(wallets.length) }, { label: 'Threshold', value: usd(min) }], notes: [] });
    }
    case 'chain-inflow': {
      const chain = input.chain ?? '';
      if (!ALERT_CHAINS.includes(chain as (typeof ALERT_CHAINS)[number])) throw new Error(`Smart-money flow alerts cover ${ALERT_CHAINS.length} chains; ${chainName(chain) || 'this one'} is not among them.`);
      const suggested = chainInflowDefault(chain);
      const min = minUsd(suggested);
      const data = SmTokenFlowsAlertData.parse({ chains: [chain], events: ['sm-token-flows'], inflow_1h: { min } });
      return draft(`${chainName(chain)} smart-money inflow surge`, 'sm-token-flows', '1h', data, channel,
        `Peregrine flow alert: smart money buys over ${usd(min)} of a single token on ${chainName(chain)} within an hour.`,
        { title: 'Chain inflow alert', formula: 'sm-token-flows, 1h window: any token on the chain with smart-money inflow ≥ threshold\ndefault = 90th percentile of the positive hourly smart-money token net flows the scanner saw on this chain over 3 days, at least $25K', inputs: [{ label: 'Chain', value: chainName(chain) }, { label: 'Suggested', value: usd(suggested) }, { label: 'Threshold', value: usd(min) }], notes: [] });
    }
    case 'deployer': {
      const chain = input.chain ?? '';
      const [deployer] = addresses(input.addresses);
      if (!deployer || !/^0x[0-9a-f]{40}$/.test(deployer)) throw new Error('A deployer alert needs the deployer\'s EVM address.');
      const data = SmartContractCallAlertData.parse({ chains: [chain], events: ['smart-contract-call'], inclusion: { caller: [{ type: 'address', value: deployer }] } });
      return draft(`deployer ${deployer.slice(0, 8)}… moves on ${chainName(chain)}`, 'smart-contract-call', 'realtime', data, channel,
        `Peregrine insider alert: the token deployer ${deployer.slice(0, 10)}… calls any contract on ${chainName(chain)}.`,
        { title: 'Deployer alert', formula: 'smart-contract-call, realtime: caller = the deployer address, any contract, any method', inputs: [{ label: 'Deployer', value: deployer }, { label: 'Chain', value: chainName(chain) }], notes: ['A deployer calling contracts again (adding liquidity, minting, moving funds) is often the first sign of what comes next.'] });
    }
    case 'token-flows': {
      const chain = input.chain ?? '', token = (input.token ?? '').trim();
      if (!ALERT_CHAINS.includes(chain as (typeof ALERT_CHAINS)[number]) || !token) throw new Error('Choose a chain in Nansen\'s smart-money set and a token.');
      const min = minUsd(25_000);
      const data = SmTokenFlowsAlertData.parse({ chains: [chain], events: ['sm-token-flows'], inflow_1d: { min }, inclusion: { tokens: [{ chain, address: token }] } });
      return draft(`token ${token.slice(0, 8)}… smart-money buying`, 'sm-token-flows', '1h', data, channel,
        `Peregrine token alert: smart money buys over ${usd(min)} of this token in a day on ${chainName(chain)}.`,
        { title: 'Token inflow alert', formula: 'sm-token-flows: this token, smart-money inflow over 1 day ≥ threshold', inputs: [{ label: 'Token', value: token }, { label: 'Threshold', value: usd(min) }], notes: [] });
    }
    case 'wallets': {
      const wallets = addresses(input.addresses).slice(0, MAX_SUBJECTS);
      if (!wallets.length) throw new Error('Add at least one wallet address.');
      const min = minUsd(10_000);
      const chains = input.chain && ALERT_CHAINS.includes(input.chain as (typeof ALERT_CHAINS)[number]) ? [input.chain] : ALERT_CHAINS;
      const data = CommonTokenTransferAlertData.parse({ chains, subjects: wallets.map((value) => ({ type: 'address', value })), events: ['buy', 'sell', 'swap', 'send', 'receive'], usdValue: { min } });
      return draft(`${wallets.length} wallet${wallets.length === 1 ? '' : 's'} move over ${usd(min)}`, 'common-token-transfer', 'realtime', data, channel,
        `Peregrine wallet alert: ${wallets.length === 1 ? 'this wallet' : `any of ${wallets.length} wallets`} moves over ${usd(min)}${chains.length === 1 ? ` on ${chainName(chains[0])}` : ''}.`,
        { title: 'Wallet alert', formula: 'common-token-transfer, realtime: subjects = your wallets; every direction; value ≥ threshold', inputs: [{ label: 'Wallets', value: String(wallets.length) }, { label: 'Threshold', value: usd(min) }], notes: [] });
    }
  }
}

/** What the builder can offer this viewer: fronts (owner only) and the follow list. */
export function builderContext(ctx: RequestContext): { fronts: Array<{ from: string; to: string; netUsd: number; wallets: number }>; follows: number; chains: string[] } {
  const scope = followScope(ctx);
  return {
    fronts: ctx.mode === 'owner' ? rotationFronts(24).slice(0, 10).map((f) => ({ from: f.from, to: f.to, netUsd: f.netUsd, wallets: f.wallets.length })) : [],
    follows: scope ? readFollows(scope).length : 0,
    chains: [...ALERT_CHAINS],
  };
}

export async function createDraft(d: AlertDraft): Promise<void> {
  const existing = await listTideAlerts();
  if (existing.length >= MAX_TIDE_ALERTS) throw new Error(`Peregrine keeps at most ${MAX_TIDE_ALERTS} alerts per account; delete one first.`);
  await callNansen<unknown>('smart-alert', d.request, { method: 'POST', skipCache: true, record: false });
}

/** Rename, change the window or the destination of one of TIDE's own alerts. */
export async function updateAlert(id: string, patch: { name?: string; timeWindow?: string; channel?: AlertChannel; description?: string }): Promise<void> {
  if (!(await listTideAlerts()).some((a) => a.id === id)) throw new Error('Not a Peregrine alert.');
  const body = UpdateAlertRequest.parse({
    id,
    ...(patch.name ? { name: `${TIDE_PREFIX}${patch.name.slice(alertPrefixOf(patch.name)?.length ?? 0).slice(0, 80)}` } : {}),
    ...(patch.timeWindow ? { timeWindow: SmartAlertTimeWindow.parse(patch.timeWindow) } : {}),
    ...(patch.channel ? { channels: [patch.channel] } : {}),
    ...(patch.description ? { description: patch.description.slice(0, 300) } : {}),
  });
  await callNansen<unknown>('smart-alert', body, { method: 'PATCH', skipCache: true, record: false });
}
