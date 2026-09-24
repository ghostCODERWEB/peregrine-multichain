// Storm alerts (spec 6.2) through Nansen Smart Alerts, so TIDE keeps
// watching when the tab is closed. Two alerts per token, both derived from
// the token's Storm Score:
//  - sm-token-flows: smart money selling more than a threshold in a day —
//    the riskier the token, the lower (more sensitive) the threshold;
//  - common-token-transfer: any wallet in an insider cluster selling or
//    sending the token above a size floor (only when clusters were found).
// TIDE only lists, toggles and deletes the alerts it created (name prefix),
// and never sends a channel's chat id or webhook back to the browser.
import { callNansen } from '@/server/nansen/client';
import { getDb } from '@/server/nansen/db';
import { CreateAlertRequest, SmTokenFlowsAlertData, CommonTokenTransferAlertData, AlertChannel } from '@/types/nansen/smart-alerts';
import type { Provenance } from '@/lib/provenance';
import { usd, num } from '@/lib/viz/format';

/** New alerts are named with this prefix on the user's Nansen account. */
export const TIDE_PREFIX = 'Peregrine · ';
/** Alerts created before the rebrand ("TIDE · …") stay recognized, listed
 *  and manageable; renaming one re-prefixes it with the current prefix. */
export const ALERT_PREFIXES = [TIDE_PREFIX, 'TIDE · '] as const;
/** The prefix an alert name carries, or null when it is not ours. */
export const alertPrefixOf = (name: unknown): string | null =>
  typeof name === 'string' ? ALERT_PREFIXES.find((p) => name.startsWith(p)) ?? null : null;

export interface AlertPlan {
  symbol: string;
  storm: number;
  band: string;
  outflowThresholdUsd: number;
  insiderThresholdUsd: number | null;
  insiderWallets: number;
  requests: CreateAlertRequest[];
  provenance: Provenance;
}

export type ChannelInput = { type: 'telegram'; chatId: string } | { type: 'discord'; webhookUrl: string };

/** Channel as the API wants it, validated — chat ids are numeric (groups
 *  start with "-"), webhooks must be https Discord URLs. */
export function toChannel(c: ChannelInput): AlertChannel {
  if (c.type === 'telegram') {
    if (!/^-?\d{4,20}$/.test(c.chatId.trim())) throw new Error('A Telegram chat id is a number (group chats start with "-").');
    return AlertChannel.parse({ type: 'telegram', data: { chatId: c.chatId.trim() } });
  }
  const u = c.webhookUrl.trim();
  if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(u)) throw new Error('A Discord webhook URL starts with https://discord.com/api/webhooks/.');
  return AlertChannel.parse({ type: 'discord', data: { webhookUrl: u } });
}

/**
 * Threshold for the smart-money outflow alert: 0.2% of market cap, scaled
 * by (1.5 − Storm/100) — a Storm Warning token (90) alerts at 0.6× that,
 * a Clear one (10) at 1.4× — clamped to $5K–$5M.
 */
export function outflowThreshold(storm: number, marketCapUsd: number | null): number {
  const base = (marketCapUsd ?? 0) * 0.002;
  return Math.round(Math.min(5_000_000, Math.max(5_000, base * (1.5 - storm / 100))));
}

export function planStormAlerts(chain: string, token: string, clusterWallets: string[], channel: AlertChannel): AlertPlan {
  const r = getDb().prepare(`
    SELECT symbol, score, band, market_cap_usd FROM storm_scores WHERE chain = ? AND token_address = ? ORDER BY id DESC LIMIT 1
  `).get(chain, token.toLowerCase()) as { symbol: string | null; score: number; band: string; market_cap_usd: number | null } | undefined;
  if (!r) throw new Error('No Storm Score for this token yet: open its page first so Peregrine can compute one.');
  const symbol = r.symbol ?? token.slice(0, 8);
  const threshold = outflowThreshold(r.score, r.market_cap_usd);
  const tokenRef = [{ chain, address: token }];

  const flows = SmTokenFlowsAlertData.parse({
    chains: [chain], events: ['sm-token-flows'],
    outflow_1d: { min: threshold },
    inclusion: { tokens: tokenRef },
  });
  const requests: CreateAlertRequest[] = [CreateAlertRequest.parse({
    name: `${TIDE_PREFIX}${symbol} smart-money outflow`,
    type: 'sm-token-flows', timeWindow: '1h', channels: [channel], data: flows,
    description: `Peregrine storm alert: smart money sold over ${usd(threshold)} of ${symbol} (${chain}) in a day. Threshold from Storm Score ${num(r.score, 0)} (${r.band}).`,
  })];

  const wallets = [...new Set(clusterWallets.filter((w) => /^[A-Za-z0-9]{20,70}$/.test(w)))].slice(0, 20);
  let insiderThreshold: number | null = null;
  if (wallets.length) {
    insiderThreshold = Math.round(Math.max(2_000, (r.market_cap_usd ?? 0) * 0.0005));
    const transfer = CommonTokenTransferAlertData.parse({
      chains: [chain], subjects: wallets.map((value) => ({ type: 'address', value })), events: ['sell', 'send'],
      usdValue: { min: insiderThreshold }, inclusion: { tokens: tokenRef },
    });
    requests.push(CreateAlertRequest.parse({
      name: `${TIDE_PREFIX}${symbol} insider cluster moves`,
      type: 'common-token-transfer', timeWindow: 'realtime', channels: [channel], data: transfer,
      description: `Peregrine storm alert: one of ${wallets.length} clustered insider wallets sold or sent over ${usd(insiderThreshold)} of ${symbol} (${chain}).`,
    }));
  }
  return {
    symbol, storm: r.score, band: r.band, outflowThresholdUsd: threshold, insiderThresholdUsd: insiderThreshold, insiderWallets: wallets.length, requests,
    provenance: {
      title: `Storm alert thresholds — ${symbol}`,
      formula: 'outflow alert: smart money sells > clamp($5K, 0.2% × mcap × (1.5 − Storm/100), $5M) in 1 day\ninsider alert: a clustered wallet sells/sends > max($2K, 0.05% × mcap), realtime',
      inputs: [
        { label: 'Storm Score', value: `${num(r.score, 0)} (${r.band})` },
        { label: 'Market cap', value: usd(r.market_cap_usd) },
        { label: 'Outflow threshold', value: usd(threshold) },
        { label: 'Insider wallets watched', value: String(wallets.length) },
      ],
      calls: requests.map((body) => ({ endpoint: 'smart-alert', body: { ...body, channels: '<your channel>' } })),
    },
  };
}

export async function createAlerts(plan: AlertPlan): Promise<number> {
  let n = 0;
  for (const body of plan.requests) {
    await callNansen<unknown>('smart-alert', body, { method: 'POST', skipCache: true, record: false });
    n++;
  }
  return n;
}

interface RawAlert {
  id: string; name: string; description?: string | null; isEnabled: boolean; type: string; timeWindow: string;
  triggerTimes?: number; lastTriggerTimestamp?: string | null; createdAt?: string; channels?: Array<{ type: string }>;
  errorMessage?: string | null;
}

export interface TideAlert {
  id: string; name: string; description: string | null; isEnabled: boolean; type: string; timeWindow: string;
  triggers: number; lastTriggered: string | null; createdAt: string | null; channels: string[]; error: string | null;
}

/** TIDE's own alerts, with channel details reduced to their type. */
export async function listTideAlerts(): Promise<TideAlert[]> {
  const r = await callNansen<unknown>('smart-alert/list', {}, { method: 'GET', skipCache: true, record: false });
  const rows: RawAlert[] = Array.isArray(r.data) ? (r.data as RawAlert[]) : [];
  return rows
    .filter((a) => alertPrefixOf(a?.name) != null)
    .map((a) => ({
      id: a.id, name: a.name.slice(alertPrefixOf(a.name)!.length), description: a.description ?? null, isEnabled: !!a.isEnabled, type: a.type, timeWindow: a.timeWindow,
      triggers: a.triggerTimes ?? 0, lastTriggered: a.lastTriggerTimestamp ?? null, createdAt: a.createdAt ?? null,
      channels: (a.channels ?? []).map((c) => c.type), error: a.errorMessage ?? null,
    }));
}

async function ownAlert(id: string): Promise<void> {
  if (!(await listTideAlerts()).some((a) => a.id === id)) throw new Error('Not a Peregrine alert.');
}

export async function toggleAlert(id: string, isEnabled: boolean): Promise<void> {
  await ownAlert(id);
  await callNansen<unknown>('smart-alert/toggle', { id, isEnabled }, { method: 'PATCH', skipCache: true, record: false });
}

export async function deleteAlert(id: string): Promise<void> {
  await ownAlert(id);
  await callNansen<unknown>(`smart-alert/${encodeURIComponent(id)}`, {}, { method: 'DELETE', skipCache: true, record: false });
}
