// ⌘K commands (L5), server side. Preview resolves the token with Nansen's free
// search and prices the command; run executes the one inline, priced command
// (1 credit) only when asked. Navigation commands just return a link to an
// existing page, which applies its own redaction and pricing.
import { callNansen } from '@/server/nansen/client';
import { fixtureMode, requestDay } from '@/server/nansen/demo';
import { contractUnavailable } from '@/server/nansen/support';
import { detectAddress } from '@/lib/address-family';
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { chainName } from '@/lib/viz/format';
import { parseCommand, refersToPage, windowLabel, type Command } from '@/lib/commands';
import type { NansenCallRef } from '@/lib/provenance';
import type { TGMWhoBoughtSoldResponse, ProfilerAddressRelatedWalletsResponse } from '@/types/nansen/api.gen';
import { omnibox } from './omnibox';

export interface Target { chain: string; address: string; name: string }
export interface CommandPreview { command: Command; title: string; target: Target | null; cost: number; href: string | null; problem: string | null }
export interface CommandRow { address: string; label: string | null; detail: string; href: string }
export interface CommandAnswer { preview: CommandPreview; rows: CommandRow[]; call: NansenCallRef; credits: number; at: number; recordedNote: string | null }

const TOKEN_PATH = /^\/token\/([a-z0-9-]+)\/([^/?#]+)/;
/** The token of the page the palette was opened on, for "this". */
export function pageToken(path: string | null): Target | null {
  const m = path?.match(TOKEN_PATH);
  if (!m || !ALL_CHAIN_IDS.includes(m[1])) return null;
  const address = decodeURIComponent(m[2]);
  return /^[A-Za-z0-9:._-]{20,160}$/.test(address) ? { chain: m[1], address, name: 'this token' } : null;
}

async function resolveToken(arg: string, path: string | null): Promise<Target | null> {
  if (refersToPage(arg)) return pageToken(path);
  const r = await omnibox(arg);
  for (const x of r.results) {
    const m = x.kind === 'token' ? x.href?.match(TOKEN_PATH) : null;
    if (m) return { chain: m[1], address: decodeURIComponent(m[2]), name: x.title };
  }
  return null;
}

const usdS = (x: number) => (x >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : x >= 1e3 ? `$${(x / 1e3).toFixed(1)}K` : `$${Math.round(x)}`);
const q = encodeURIComponent;

export async function previewCommand(raw: string, path: string | null): Promise<CommandPreview | null> {
  const command = parseCommand(raw);
  if (!command) return null;
  const base = { command, target: null, cost: 0, href: null, problem: null };
  if (command.kind === 'help') return { ...base, title: 'Commands' };
  if (command.kind === 'desk') return { ...base, title: 'Open your Desk', href: '/desk' };
  if (command.kind === 'related') {
    const fam = detectAddress(command.address).map((f) => f.family);
    const chain = command.chain ?? (fam.includes('evm') ? 'ethereum' : fam.includes('solana') ? 'solana' : null);
    if (!fam.length) return { ...base, title: 'Related wallets', problem: 'That doesn’t look like a wallet address.' };
    if (!chain || !ALL_CHAIN_IDS.includes(chain)) return { ...base, title: 'Related wallets', problem: 'Add the chain, e.g. “/related 0x… on base”.' };
    const gap = contractUnavailable('POST /api/v1/profiler/address/related-wallets', chain, 'Related wallets');
    return { ...base, title: `Wallets Nansen links to ${command.address.slice(0, 8)}… on ${chainName(chain)}`, target: { chain, address: command.address, name: command.address }, cost: 1, problem: gap };
  }
  const target = await resolveToken(command.token, path);
  if (!target) return { ...base, title: 'Command', problem: refersToPage(command.token) ? '“this” works on a token page; name the token instead.' : `Nansen’s search found no token for “${command.token}”.` };
  const t = { ...base, target };
  const page = `/token/${target.chain}/${q(target.address)}`;
  switch (command.kind) {
    case 'who': {
      const gap = contractUnavailable('POST /api/v1/tgm/who-bought-sold', target.chain, 'Buyers and sellers');
      return { ...t, title: `Who ${command.side === 'buy' ? 'bought' : 'sold'} ${target.name} on ${chainName(target.chain)} in the last ${windowLabel(command.hours)}`, cost: 1, problem: gap };
    }
    case 'replay': return { ...t, title: `Time Machine: ${target.name} at T−${command.at}`, href: `/replay/${target.chain}/${q(target.address)}?at=${command.at}` };
    case 'call': return { ...t, title: `Make a call on ${target.name}`, href: `${page}#call` };
    case 'follow': return { ...t, title: `Did anyone follow smart money on ${target.name}?`, href: `${page}?view=flow#follow` };
    case 'alert': return { ...t, title: `Alert on large moves in ${target.name} (Smart Alert builder)`, href: `/alerts?template=token-flows&chain=${target.chain}&token=${q(target.address)}` };
  }
}

/** Runs a priced inline command. Callers check confirmation and strip labels
 *  for public views. Never recorded as a fixture: windows are one-off. */
export async function runCommand(p: CommandPreview, now = Date.now()): Promise<CommandAnswer> {
  if (!p.target || p.problem || p.cost === 0) throw new Error(p.problem ?? 'This command opens a page; nothing to run.');
  const c = p.command;
  if (c.kind === 'who') {
    const field = c.side === 'buy' ? 'bought_volume_usd' : 'sold_volume_usd';
    // A recorded demo can't replay an arbitrary window; it answers from the
    // token page's recorded 7-day request instead, and says so.
    const recorded = fixtureMode() === 'replay';
    const body = recorded
      ? { chain: p.target.chain, token_address: p.target.address, buy_or_sell: c.side === 'buy' ? 'BUY' : 'SELL', date: { from: requestDay(7), to: requestDay(-1) }, pagination: { page: 1, per_page: 20 }, order_by: [{ field, direction: 'DESC' }] }
      : { chain: p.target.chain, token_address: p.target.address, buy_or_sell: c.side === 'buy' ? 'BUY' : 'SELL', date: { from: new Date(now - c.hours * 3_600_000).toISOString(), to: new Date(now).toISOString() }, pagination: { page: 1, per_page: 15 }, order_by: [{ field, direction: 'DESC' }] };
    const r = await callNansen<TGMWhoBoughtSoldResponse>('tgm/who-bought-sold', body, { record: false });
    const rows = r.data.data.filter((x) => x.address && (c.side === 'buy' ? (x.bought_volume_usd ?? 0) : (x.sold_volume_usd ?? 0)) > 0).map((x) => ({
      address: x.address, label: x.address_label ?? null,
      detail: `${c.side === 'buy' ? 'bought' : 'sold'} ${usdS((c.side === 'buy' ? x.bought_volume_usd : x.sold_volume_usd) ?? 0)}${(c.side === 'buy' ? x.sold_volume_usd : x.bought_volume_usd) ? ` · ${c.side === 'buy' ? 'sold' : 'bought'} ${usdS((c.side === 'buy' ? x.sold_volume_usd : x.bought_volume_usd) ?? 0)}` : ''}`,
      href: `/wallet/${q(x.address)}?chain=${p.target!.chain}`,
    }));
    return { preview: p, rows: rows.slice(0, 15), call: { endpoint: 'tgm/who-bought-sold', body, credits: 1, ref: recorded ? 'recorded' : r.meta.cacheHit ? 'cache' : 'live' }, credits: recorded || r.meta.cacheHit ? 0 : r.meta.creditsCost, at: now, recordedNote: recorded ? 'Recorded demo: the recorded 7-day buyers and sellers, not the window you typed.' : null };
  }
  if (c.kind === 'related') {
    const body = { address: p.target.address, chain: p.target.chain, pagination: { page: 1, per_page: 20 } };
    const r = await callNansen<ProfilerAddressRelatedWalletsResponse>('profiler/address/related-wallets', body, { record: false });
    const rows = r.data.data.filter((x) => x.address).map((x) => ({
      address: x.address, label: x.address_label ?? null,
      detail: [x.relation, x.chain ? chainName(x.chain) : null, x.block_timestamp ? x.block_timestamp.slice(0, 10) : null].filter(Boolean).join(' · '),
      href: `/wallet/${q(x.address)}${x.chain ? `?chain=${x.chain}` : ''}`,
    }));
    return { preview: p, rows, call: { endpoint: 'profiler/address/related-wallets', body, credits: 1, ref: r.meta.cacheHit ? 'cache' : 'live' }, credits: r.meta.cacheHit ? 0 : r.meta.creditsCost, at: now, recordedNote: null };
  }
  throw new Error('This command opens a page; nothing to run.');
}
