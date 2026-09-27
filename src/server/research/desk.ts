// Research Desk: turns a question about a token, a wallet or the market into an evidence pack drawn from
// Peregrine's own derived analytics over Nansen data (Token Score and Verdict, Smart Money flow, Cascades
// entry order, Copy Lab followability, market data), then asks Nansen's agent for a cited report.
import { getDb, getKv, setKv } from '@/server/nansen/db';
import { tokenVerdict } from '@/server/token/verdict';
import { cascades } from '@/server/cascade/cascades';
import { cachedCopyLab } from '@/server/copy/followability';
import { ensAddress, ensName, ENS_NAME_RE } from '@/server/ens';
import { marketPulse } from '@/server/pulse';
import { properAddress } from '@/server/nansen/address-case';
import { usd, pct, walletName, chainName } from '@/lib/viz/format';

export type Mode = 'token' | 'wallet' | 'leaders' | 'market';
export interface EvidenceItem { id: string; title: string; value: string; detail: string; href?: string; source: string; tone?: 'good' | 'bad' | 'neutral' }
export type Target = { kind: 'token'; chain: string; address: string; symbol: string | null } | { kind: 'wallet'; address: string; name: string } | { kind: 'market' };

const D = 86_400_000;
const fmtMin = (m: number) => (Math.abs(m) >= 1440 ? `${(Math.abs(m) / 1440).toFixed(1)} days` : Math.abs(m) >= 60 ? `${(Math.abs(m) / 60).toFixed(1)} h` : `${Math.round(Math.abs(m))} min`);

/** Resolve free text into a research target: EVM or Solana address (token or wallet), ENS name, or token symbol. */
export async function resolveTarget(input: string, mode: Mode): Promise<Target | { error: string }> {
  const q = input.trim();
  if (mode === 'market') return { kind: 'market' };
  if (!q) return { error: 'Enter a token symbol, contract address, wallet address or ENS name.' };
  const db = getDb();
  if (ENS_NAME_RE.test(q)) {
    const a = await ensAddress(q).catch(() => null);
    return a ? { kind: 'wallet', address: a, name: q.toLowerCase() } : { error: `${q} does not point to an address.` };
  }
  const isAddr = /^0x[0-9a-fA-F]{40}$/.test(q) || /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q);
  if (isAddr) {
    const tok = db.prepare(`SELECT chain, token_address AS a, symbol FROM token_pulse WHERE lower(token_address) = lower(?) ORDER BY snapshot_at DESC LIMIT 1`).get(q) as { chain: string; a: string; symbol: string | null } | undefined
      ?? db.prepare(`SELECT chain, token_address AS a, MAX(token_symbol) AS symbol FROM smart_money_trades WHERE lower(token_address) = lower(?) GROUP BY chain, token_address LIMIT 1`).get(q) as { chain: string; a: string; symbol: string | null } | undefined;
    if (tok && mode !== 'wallet') return { kind: 'token', chain: tok.chain, address: properAddress(tok.chain, tok.a), symbol: tok.symbol };
    const label = (db.prepare(`SELECT MAX(wallet_label) AS l FROM smart_money_trades WHERE lower(wallet) = lower(?)`).get(q) as { l: string | null }).l;
    const ens = /^0x/.test(q) ? await Promise.race([ensName(q), new Promise<null>((r) => setTimeout(() => r(null), 2500))]) : null;
    return { kind: 'wallet', address: q, name: ens ?? walletName(label, q) };
  }
  // A symbol: the most traded token with it, then the most Smart-Money-bought.
  const sym = q.replace(/^\$/, '');
  const hit = db.prepare(`SELECT chain, token_address AS a, symbol FROM token_pulse WHERE upper(symbol) = upper(?) AND window = '24h' ORDER BY volume DESC LIMIT 1`).get(sym) as { chain: string; a: string; symbol: string } | undefined
    ?? db.prepare(`SELECT chain, token_address AS a, MAX(token_symbol) AS symbol FROM smart_money_trades WHERE upper(token_symbol) = upper(?) GROUP BY chain, token_address ORDER BY COUNT(*) DESC LIMIT 1`).get(sym) as { chain: string; a: string; symbol: string } | undefined;
  return hit ? { kind: 'token', chain: hit.chain, address: properAddress(hit.chain, hit.a), symbol: hit.symbol } : { error: `No token called ${sym} in Peregrine's stored Nansen data. Paste its contract address.` };
}

export interface Step { id: string; label: string; run: () => EvidenceItem[] | Promise<EvidenceItem[]> }

/** The research plan for a target: each step reads one derived dataset and returns numbered-later evidence. */
export function planFor(t: Target, mode: Mode): Step[] {
  const db = getDb(), now = Date.now();
  if (t.kind === 'token') {
    const tokenHref = `/token/${t.chain}/${encodeURIComponent(t.address)}`;
    const steps: Step[] = [
      { id: 'score', label: 'Token Score and verdict', run: () => {
        const v = tokenVerdict(t.chain, t.address);
        if (v.pending) return [{ id: '', title: 'Token Score', value: 'not scored yet', detail: 'Open the token page once to score it.', href: tokenHref, source: 'Token Score', tone: 'neutral' }];
        return [
          { id: '', title: 'Token Score', value: `${Math.round(v.score)}/100 · ${v.level}`, detail: `Nansen risk ${v.nansen != null ? Math.round(v.nansen) : 'n/a'} · Peregrine model ${v.peregrine != null ? Math.round(v.peregrine) : 'n/a'}`, href: tokenHref, source: 'Token Score (Nansen tgm/indicators, holders, flows)', tone: v.level === 'danger' ? 'bad' : v.level === 'watch' ? 'neutral' : 'good' },
          ...v.reasons.slice(0, 3).map((r) => ({ id: '', title: 'Risk signal', value: r.text.split('(')[0].trim(), detail: r.text, href: tokenHref, source: 'Token Score sub-scores', tone: r.tone }) as EvidenceItem),
        ];
      } },
      { id: 'flow', label: 'Smart Money flow, 24h and 7d', run: () => {
        const row = (since: number) => db.prepare(`SELECT SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT CASE WHEN side='buy' THEN wallet END) AS b, COUNT(DISTINCT CASE WHEN side='sell' THEN wallet END) AS s FROM smart_money_trades WHERE chain = ? AND lower(token_address) = lower(?) AND traded_at >= ?`).get(t.chain, t.address, since) as { net: number | null; b: number; s: number };
        const d1 = row(now - D), d7 = db.prepare(`SELECT SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT CASE WHEN side='buy' THEN wallet END) AS b, COUNT(DISTINCT CASE WHEN side='sell' THEN wallet END) AS s FROM cascade_trades WHERE chain = ? AND lower(token_address) = lower(?) AND traded_at >= ?`).get(t.chain, t.address, now - 7 * D) as { net: number | null; b: number; s: number };
        const out: EvidenceItem[] = [];
        if (d1.b + d1.s) out.push({ id: '', title: 'Smart Money, 24h', value: usd(d1.net ?? 0, { signed: true }), detail: `${d1.b} wallets buying, ${d1.s} selling (Nansen smart-money/dex-trades)`, href: tokenHref, source: 'Smart Money DEX trades', tone: (d1.net ?? 0) >= 0 ? 'good' : 'bad' });
        if (d7.b + d7.s) out.push({ id: '', title: 'Smart Money, 7d', value: usd(d7.net ?? 0, { signed: true }), detail: `${d7.b} wallets buying, ${d7.s} selling (Nansen tgm/dex-trades, only Smart Money)`, href: tokenHref, source: 'Token God Mode trades', tone: (d7.net ?? 0) >= 0 ? 'good' : 'bad' });
        if (!out.length) out.push({ id: '', title: 'Smart Money', value: 'no recent trades', detail: 'No Smart Money DEX trades stored for this token in 7 days.', source: 'Smart Money DEX trades', tone: 'neutral' });
        return out;
      } },
      { id: 'cascade', label: 'Who entered first (Cascades)', run: () => {
        const c = cascades();
        const eps = c.episodes.filter((e) => e.chain === t.chain && e.token.toLowerCase() === t.address.toLowerCase());
        if (!eps.length) return [{ id: '', title: 'Entry order', value: 'no multi-wallet episode', detail: 'Fewer than three Smart Money wallets entered within one 72h window.', href: '/cascade', source: 'Cascades', tone: 'neutral' }];
        const e = [...eps].sort((a, b) => b.start - a.start)[0], roles = new Map(c.stats.map((s) => [s.wallet, s]));
        const leadersIn = e.entries.filter((x) => roles.get(x.wallet)?.role === 'leader');
        const followersIn = e.entries.filter((x) => roles.get(x.wallet)?.role === 'follower');
        const first = e.entries[0];
        return [
          { id: '', title: 'Latest Smart Money episode', value: `${e.entries.length} wallets`, detail: `first in: ${walletName(first.label, first.wallet)}, ${new Date(first.at).toISOString().slice(0, 16).replace('T', ' ')} UTC`, href: '/cascade', source: 'Cascades (entry order)', tone: 'neutral' },
          { id: '', title: 'Proven leaders in it', value: String(leadersIn.length), detail: leadersIn.length ? `${leadersIn.slice(0, 3).map((x) => `${walletName(x.label, x.wallet)} (#${x.rank})`).join(', ')}` : 'None of the statistically early wallets are in this episode.', href: '/cascade', source: 'Cascades leader test (z-test, FDR)', tone: leadersIn.length ? 'good' : 'neutral' },
          ...(followersIn.length ? [{ id: '', title: 'Consistent followers in it', value: String(followersIn.length), detail: 'wallets that usually enter late: their buying often comes after the move', href: '/cascade', source: 'Cascades follower test', tone: 'bad' } as EvidenceItem] : []),
        ];
      } },
      { id: 'copy', label: 'Followable wallets holding it (Copy Lab)', run: () => {
        const lab = cachedCopyLab();
        if (!lab) return [];
        const good = lab.wallets.filter((w) => w.score >= 65 && w.recent.some((r) => r.chain === t.chain && r.token.toLowerCase() === t.address.toLowerCase()));
        return [{ id: '', title: 'Followable wallets that bought', value: String(good.length), detail: good.length ? good.slice(0, 3).map((w) => `${walletName(w.label, w.wallet)} (${w.score})`).join(', ') : 'No wallet with Followability 65+ bought it recently.', href: '/copy', source: 'Copy Lab (Nansen trades + 15m candles)', tone: good.length ? 'good' : 'neutral' }];
      } },
      { id: 'market', label: 'Market data', run: () => {
        const m = db.prepare(`SELECT price_usd AS p, price_change AS c, volume AS v, liquidity AS l, market_cap AS mc, age_days AS age FROM token_pulse WHERE chain = ? AND lower(token_address) = lower(?) AND window = '24h' ORDER BY snapshot_at DESC LIMIT 1`).get(t.chain, t.address) as { p: number | null; c: number | null; v: number | null; l: number | null; mc: number | null; age: number | null } | undefined;
        if (!m) return [];
        const turnover = m.v && m.l ? m.v / m.l : null;
        return [
          { id: '', title: 'Price, 24h', value: m.c != null ? pct(m.c, 1) : 'n/a', detail: `volume ${usd(m.v)} · market cap ${usd(m.mc)}`, href: tokenHref, source: 'Nansen token screener', tone: (m.c ?? 0) >= 0 ? 'good' : 'bad' },
          { id: '', title: 'Liquidity', value: usd(m.l), detail: `${turnover != null ? `${turnover.toFixed(1)}× volume/liquidity` : ''}${m.age != null ? ` · ${Math.round(m.age)} days old` : ''}`, href: tokenHref, source: 'Nansen token screener', tone: turnover != null && turnover > 5 ? 'bad' : 'neutral' },
        ];
      } },
    ];
    return mode === 'leaders' ? steps.filter((s) => s.id === 'cascade' || s.id === 'flow' || s.id === 'copy') : steps;
  }
  if (t.kind === 'wallet') {
    const href = `/wallet/${t.address}`;
    return [
      { id: 'activity', label: 'Smart Money trading, 30 days', run: () => {
        const rows = db.prepare(`SELECT token_symbol AS s, chain, token_address AS a, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(*) AS n FROM (SELECT * FROM cascade_trades UNION ALL SELECT chain, token_address, token_symbol, wallet, wallet_label, side, usd_value, traded_at, tx_hash FROM smart_money_trades) WHERE lower(wallet) = lower(?) AND traded_at >= ? GROUP BY chain, token_address ORDER BY ABS(net) DESC LIMIT 4`).all(t.address, now - 30 * D) as Array<{ s: string | null; chain: string; a: string; net: number; n: number }>;
        if (!rows.length) return [{ id: '', title: 'Smart Money trades', value: 'none stored', detail: 'This wallet has no labeled Smart Money DEX trades in 30 days.', href, source: 'Smart Money DEX trades', tone: 'neutral' }];
        return rows.map((r) => ({ id: '', title: `${r.s ?? r.a.slice(0, 6)} on ${chainName(r.chain)}`, value: usd(r.net, { signed: true }), detail: `${r.n} trades, 30 days`, href: `/token/${r.chain}/${encodeURIComponent(r.a)}`, source: 'Nansen Smart Money trades', tone: r.net >= 0 ? 'good' : 'bad' }) as EvidenceItem);
      } },
      { id: 'cascade', label: 'Where it sits in entry order (Cascades)', run: () => {
        const s = cascades().stats.find((x) => x.wallet.toLowerCase() === t.address.toLowerCase());
        if (!s) return [{ id: '', title: 'Entry order', value: 'not enough episodes', detail: 'Needs three or more multi-wallet Smart Money episodes.', href: '/cascade', source: 'Cascades', tone: 'neutral' }];
        return [{ id: '', title: 'Entry order role', value: s.role === 'leader' ? 'Leader' : s.role === 'follower' ? 'Follower' : 'No consistent order', detail: `${s.episodes} episodes · first in ${s.firsts} · typically ${fmtMin(s.medianLeadMin ?? 0)} ${(s.medianLeadMin ?? 0) >= 0 ? 'ahead of' : 'behind'} the median entrant · p ${s.p < 0.001 ? s.p.toExponential(1) : s.p.toFixed(3)}`, href: '/cascade', source: 'Cascades leader test', tone: s.role === 'leader' ? 'good' : s.role === 'follower' ? 'bad' : 'neutral' }];
      } },
      { id: 'copy', label: 'Can you copy it? (Copy Lab)', run: () => {
        const w = cachedCopyLab()?.wallets.find((x) => x.wallet.toLowerCase() === t.address.toLowerCase());
        if (!w) return [{ id: '', title: 'Followability', value: 'not scored', detail: 'Needs three or more tokens with priced buys.', href: '/copy', source: 'Copy Lab', tone: 'neutral' }];
        return [{ id: '', title: 'Followability', value: `${w.score}/100`, detail: `copied 1h late: median ${pct(w.median[2], 1)}, win ${Math.round(w.win[2] * 100)}% over ${w.tokens} tokens`, href: '/copy', source: 'Copy Lab (Nansen trades + 15m candles)', tone: w.score >= 65 ? 'good' : w.score >= 50 ? 'neutral' : 'bad' }];
      } },
    ];
  }
  return [
    { id: 'pulse', label: 'Market Pulse signals', run: () => marketPulse('owner').slice(0, 6).map((p) => ({ id: '', title: p.kind, value: p.text.replace(/\p{Extended_Pictographic}|️/gu, '').slice(0, 80), detail: p.detail, href: p.href, source: 'Market Pulse (stored Nansen reads)', tone: p.tone === 'up' ? 'good' : p.tone === 'down' ? 'bad' : 'neutral' }) as EvidenceItem) },
    { id: 'leaders', label: 'What proven leaders bought, 48h', run: () => {
      const c = cascades();
      const leaders = new Set(c.stats.filter((s) => s.role === 'leader').map((s) => s.wallet));
      const rows = db.prepare(`SELECT token_symbol AS s, chain, token_address AS a, wallet, usd_value AS v FROM (SELECT chain, token_address, token_symbol, wallet, side, usd_value, traded_at FROM smart_money_trades UNION ALL SELECT chain, token_address, token_symbol, wallet, side, usd_value, traded_at FROM cascade_trades) WHERE side = 'buy' AND traded_at >= ? ORDER BY traded_at DESC`).all(now - 2 * D) as Array<{ s: string | null; chain: string; a: string; wallet: string; v: number }>;
      const by = new Map<string, { s: string | null; chain: string; a: string; v: number; w: Set<string> }>();
      for (const r of rows) if (leaders.has(r.wallet)) { const k = `${r.chain}|${r.a}`; const x = by.get(k) ?? { s: r.s, chain: r.chain, a: r.a, v: 0, w: new Set() }; x.v += r.v ?? 0; x.w.add(r.wallet); by.set(k, x); }
      const top = [...by.values()].sort((a, b) => b.w.size - a.w.size || b.v - a.v).slice(0, 4);
      return top.length ? top.map((x) => ({ id: '', title: `Leaders buying ${x.s ?? x.a.slice(0, 6)}`, value: `${x.w.size} leader${x.w.size === 1 ? '' : 's'}`, detail: `${usd(x.v)} on ${chainName(x.chain)}, 48h`, href: `/token/${x.chain}/${encodeURIComponent(x.a)}`, source: 'Cascades leaders × Smart Money trades', tone: 'good' }) as EvidenceItem) : [{ id: '', title: 'Leaders', value: 'quiet', detail: 'No proven leader bought in 48 hours.', href: '/cascade', source: 'Cascades', tone: 'neutral' }];
    } },
  ];
}

export function prompt(t: Target, mode: Mode, question: string, ev: EvidenceItem[]): string {
  const subject = t.kind === 'token' ? `the token ${t.symbol ?? t.address} on ${t.chain}` : t.kind === 'wallet' ? `the wallet ${t.name}` : 'the crypto market right now';
  const lines = ev.map((e) => `[${e.id}] ${e.title}: ${e.value}. ${e.detail} (source: ${e.source})`).join('\n');
  const task = mode === 'leaders' ? 'Is Smart Money leading here or following? Who got in first and does that matter?' : question || (t.kind === 'token' ? 'Should a trader be worried about this token, and is Smart Money early or late?' : t.kind === 'wallet' ? 'What kind of trader is this wallet, and is it worth following?' : 'What matters most in the market right now?');
  return `You are the research analyst inside Peregrine, an onchain intelligence terminal built on Nansen data. Research ${subject}. Question: ${task}

Evidence (use ONLY this; do not invent numbers):
${lines}

Write plain text in exactly three short sections with these headings on their own lines:
Verdict: one sentence.
Why: two to four bullet points starting with "- ", each ending with the evidence ids it relies on in brackets, like [E1][E3].
Watch: one or two bullet points on what would change the verdict.
Under 160 words. No markdown bold, no links.`;
}

export interface Report { id: string; at: number; mode: Mode; target: string; question: string; evidence: EvidenceItem[]; answer: string }
const LIST = 'research:reports';
export function saveReport(r: Report) {
  const cur = listReports();
  setKv(LIST, JSON.stringify([r, ...cur.filter((x) => x.id !== r.id)].slice(0, 30)));
}
export function listReports(): Report[] {
  const v = getKv(LIST);
  try { return v ? (JSON.parse(v.value) as Report[]) : []; } catch { return []; }
}
