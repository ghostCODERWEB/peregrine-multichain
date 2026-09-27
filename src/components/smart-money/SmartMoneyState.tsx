import Link from 'next/link';
import { TokenLogo } from '@/components/Logo';
import { AddressLink } from '@/components/entity/AddressLink';
import { StatStrip } from '@/components/StatStrip';
import { TimelineFilter } from './TimelineFilter';
import { ExplainView } from '@/components/ExplainView';
import { getDb } from '@/server/nansen/db';
import { perpChanges } from '@/server/perps/terminal';
import { chainName, pct, usd } from '@/lib/viz/format';

type Ev = { at: number; kind: 'spot' | 'perp'; wallet: string; label: string | null; verb: string; tone: 'in' | 'out'; asset: string; what: React.ReactNode; usd: number; n?: number };

/** Merges identical actions in the same minute (one wallet reducing the same short five times) into one row with a count. */
function merge(events: Ev[]): Ev[] {
  const by = new Map<string, Ev>();
  for (const e of events) {
    const k = `${Math.floor(e.at / 60_000)}|${e.wallet.toLowerCase()}|${e.asset}|${e.verb}`;
    const cur = by.get(k);
    if (cur) { cur.usd += e.usd; cur.n = (cur.n ?? 1) + 1; } else by.set(k, { ...e, n: 1 });
  }
  return [...by.values()].sort((a, b) => b.at - a.at || b.usd - a.usd);
}

/** Smart Money state (24h) and one chronological feed across spot and perps. Stored data only. */
export function SmartMoneyState() {
  const db = getDb();
  const now = Date.now(), day = 86_400_000;
  const agg = (from: number, to: number) => db.prepare(`SELECT SUM(CASE WHEN side='buy' THEN usd_value ELSE 0 END) AS inflow, SUM(CASE WHEN side='sell' THEN usd_value ELSE 0 END) AS outflow, COUNT(DISTINCT wallet) AS w FROM smart_money_trades WHERE traded_at >= ? AND traded_at < ?`).get(from, to) as { inflow: number | null; outflow: number | null; w: number };
  const cur = agg(now - day, now), prev = agg(now - 2 * day, now - day);
  const net = (cur.inflow ?? 0) - (cur.outflow ?? 0), prevNet = (prev.inflow ?? 0) - (prev.outflow ?? 0);
  const chains = db.prepare(`SELECT chain, SUM(usd_value) AS v FROM smart_money_trades WHERE traded_at >= ? GROUP BY chain ORDER BY v DESC LIMIT 1`).get(now - day) as { chain: string; v: number } | undefined;
  const toks = db.prepare(`SELECT chain, token_address AS t, MAX(token_symbol) AS s, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT wallet) AS w FROM smart_money_trades WHERE traded_at >= ? GROUP BY chain, token_address`).all(now - day) as Array<{ chain: string; t: string; s: string | null; net: number; w: number }>;
  const acc = [...toks].sort((a, b) => b.net - a.net)[0], dis = [...toks].sort((a, b) => a.net - b.net)[0];

  const events: Ev[] = (db.prepare(`SELECT wallet, wallet_label AS label, side, chain, token_address AS t, token_symbol AS s, usd_value AS v, traded_at AS at FROM smart_money_trades WHERE traded_at >= ? AND usd_value >= 25000 ORDER BY traded_at DESC LIMIT 60`).all(now - day) as Array<{ wallet: string; label: string | null; side: string; chain: string; t: string; s: string | null; v: number; at: number }>)
    .map((r) => ({ at: r.at, kind: 'spot', wallet: r.wallet, label: r.label, verb: r.side === 'buy' ? 'bought' : 'sold', tone: r.side === 'buy' ? 'in' : 'out', usd: r.v, asset: `${r.chain}:${r.t}`,
      what: <Link prefetch={false} href={`/token/${r.chain}/${encodeURIComponent(r.t)}`} className="inline-flex items-center gap-1 font-semibold text-ink hover:underline"><TokenLogo symbol={r.s} chain={r.chain} address={r.t} size={14} />{r.s ?? r.t.slice(0, 6)} <span className="font-normal text-ink-muted">on {chainName(r.chain)}</span></Link> }));
  for (const sym of ['BTC', 'ETH']) {
    const c = perpChanges(sym, 3_600_000);
    if ('unavailable' in c) continue;
    for (const ch of c.changes.filter((x) => x.cohorts.includes('smart_money') && x.kind !== 'left-set' && Math.abs(x.deltaUsd) >= 25_000).slice(0, 20)) {
      const verb = ch.kind === 'flipped' ? `flipped to ${ch.side}` : ch.kind === 'increased' ? `added to ${ch.side}` : ch.kind === 'reduced' ? `reduced ${ch.side}` : `${ch.kind} ${ch.side}`;
      events.push({ at: c.to, kind: 'perp', wallet: ch.address, label: ch.label, verb, tone: ch.deltaUsd >= 0 === (ch.side === 'long') ? 'in' : 'out', usd: Math.abs(ch.deltaUsd), asset: `perp:${sym}`,
        what: <Link prefetch={false} href={`/perps/${sym}?tab=changes`} className="inline-flex items-center gap-1 font-semibold text-ink hover:underline"><TokenLogo symbol={sym} coin={sym} size={14} />{sym} perp</Link> });
    }
  }
  events.sort((a, b) => b.at - a.at);
  const rows = merge(events).slice(0, 80);
  const maxUsd = Math.max(1, ...rows.map((e) => e.usd));
  const groups: Array<{ minute: number; rows: Ev[] }> = [];
  for (const e of rows) {
    const m = Math.floor(e.at / 60_000);
    if (groups.at(-1)?.minute === m) groups.at(-1)!.rows.push(e); else groups.push({ minute: m, rows: [e] });
  }
  const sum = (f: (e: Ev) => boolean) => rows.filter(f).reduce((a, e) => a + e.usd, 0);
  const spotIn = sum((e) => e.kind === 'spot' && e.tone === 'in'), spotOut = sum((e) => e.kind === 'spot' && e.tone === 'out');
  const perpLong = sum((e) => e.kind === 'perp' && /long/.test(e.verb) && e.tone === 'in'), perpShort = sum((e) => e.kind === 'perp' && /short/.test(e.verb) && e.tone === 'out');
  const hhmm = (t: number) => new Date(t).toISOString().slice(11, 16), md = (t: number) => new Date(t).toISOString().slice(5, 10);

  const context = { window: '24h', netUsd: net, prior24hNetUsd: prevNet, inflowUsd: cur.inflow, outflowUsd: cur.outflow, wallets: cur.w, priorWallets: prev.w, mostAccumulated: acc && { symbol: acc.s, chain: acc.chain, netUsd: Math.round(acc.net), wallets: acc.w }, mostDistributed: dis && { symbol: dis.s, chain: dis.chain, netUsd: Math.round(dis.net), wallets: dis.w }, mostActiveChain: chains?.chain,
    recentEvents: events.slice(0, 25).map((e) => ({ at: new Date(e.at).toISOString(), type: e.kind, wallet: e.wallet, label: e.label, action: e.verb, usd: Math.round(e.usd) })) };
  return (
    <div className="space-y-4">
      <ExplainView view="smart-money" context={context} />
      <StatStrip className="rise" stats={[
        { label: 'Smart Money DEX net, 24h', value: usd(net, { signed: true }), tone: net >= 0 ? 'in' : 'out', note: prevNet ? `prior 24h ${usd(prevNet, { signed: true })}` : undefined },
        { label: 'Inflow / outflow', value: `${usd(cur.inflow)} / ${usd(cur.outflow)}`, note: `${cur.w} wallets${prev.w ? ` (prior ${prev.w})` : ''}` },
        { label: 'Most accumulated', value: acc && acc.net > 0 ? `${acc.s ?? '?'} ${usd(acc.net, { signed: true })}` : 'n/a', note: acc ? `${acc.w} wallets · ${chainName(acc.chain)}` : undefined, href: acc && `/token/${acc.chain}/${encodeURIComponent(acc.t)}`, tone: 'in', logo: acc && acc.net > 0 ? { symbol: acc.s, chain: acc.chain, address: acc.t } : undefined },
        { label: 'Most distributed', value: dis && dis.net < 0 ? `${dis.s ?? '?'} ${usd(dis.net, { signed: true })}` : 'n/a', note: dis ? `${dis.w} wallets · ${chainName(dis.chain)}` : undefined, href: dis && `/token/${dis.chain}/${encodeURIComponent(dis.t)}`, tone: 'out', logo: dis && dis.net < 0 ? { symbol: dis.s, chain: dis.chain, address: dis.t } : undefined },
        { label: 'Most active chain', value: chains ? chainName(chains.chain) : 'n/a', note: chains ? `${usd(chains.v)} traded · ${pct(chains.v / Math.max(1, (cur.inflow ?? 0) + (cur.outflow ?? 0)), 0)} of volume` : undefined, href: chains && `/chain/${chains.chain}` },
      ]} />
      <section aria-labelledby="sm-timeline" className="material p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sm-timeline" className="t-section">Smart Money timeline</h2>
          <span className="text-[12px] text-ink-muted">Moves of $25K+ · spot 24h · BTC and ETH perps, last hour</span>
        </div>
        <TimelineFilter counts={{ all: rows.length, spot: rows.filter((e) => e.kind === 'spot').length, perp: rows.filter((e) => e.kind === 'perp').length }}
          summary={
            <p className="num flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted">
              <span>Spot <b className="text-[var(--mint)]">+{usd(spotIn)}</b> bought · <b className="text-[var(--flare)]">{usd(spotOut)}</b> sold</span>
              <span>Perps <b className="text-[var(--mint)]">{usd(perpLong)}</b> long added · <b className="text-[var(--flare)]">{usd(perpShort)}</b> short added</span>
            </p>
          }>
          <div className="max-h-[460px] overflow-y-auto" tabIndex={0} role="region" aria-label="Timeline">
            {groups.map((g) => (
              <section key={g.minute} data-kinds={[...new Set(g.rows.map((e) => e.kind))].join(' ')} aria-label={`${md(g.minute * 60_000)} ${hhmm(g.minute * 60_000)} UTC`}>
                <h3 className="num sticky top-0 z-[1] flex items-center gap-2 bg-[var(--surface-1)] py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  <span className="text-ink-2">{hhmm(g.minute * 60_000)}</span><span>{md(g.minute * 60_000)} UTC</span><span className="h-px flex-1 bg-[var(--hair)]" />
                </h3>
                <ol className="divide-y divide-[var(--hair)]">
                  {g.rows.map((e, i) => (
                    <li key={i} data-kind={e.kind} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 py-1.5 text-[12.5px] sm:grid-cols-[44px_minmax(140px,220px)_minmax(120px,170px)_minmax(120px,1fr)_minmax(120px,220px)_92px]">
                      <span className={`rounded-[5px] px-1 text-center text-[10px] font-bold ${e.kind === 'perp' ? 'bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] text-[var(--signal)]' : 'bg-ink/10 text-ink-2'}`}>{e.kind === 'perp' ? 'PERP' : 'SPOT'}</span>
                      <span className="min-w-0 truncate"><AddressLink address={e.wallet} label={e.label} compact /></span>
                      <span className="hidden items-center gap-1.5 sm:flex">
                        <span className="rounded-full px-2 py-px text-[11.5px] font-semibold" style={{ color: e.tone === 'in' ? 'var(--mint)' : 'var(--flare)', background: `color-mix(in srgb, ${e.tone === 'in' ? 'var(--mint)' : 'var(--flare)'} 12%, transparent)` }}>{e.verb}</span>
                        {(e.n ?? 1) > 1 && <span className="num text-[11px] text-ink-muted">×{e.n}</span>}
                      </span>
                      <span className="col-span-2 min-w-0 truncate sm:col-span-1"><span className="text-ink-2 sm:hidden">{e.verb}{(e.n ?? 1) > 1 ? ` ×${e.n}` : ''} </span>{e.what}</span>
                      <span className="hidden h-1.5 overflow-hidden rounded-full bg-[var(--hair)] sm:block" aria-hidden><span className="block h-full rounded-full" style={{ width: `${Math.max(3, Math.sqrt(e.usd / maxUsd) * 100)}%`, background: e.tone === 'in' ? 'var(--mint)' : 'var(--flare)', opacity: 0.75 }} /></span>
                      <span className="num row-start-1 text-right font-semibold sm:row-start-auto" style={{ color: e.tone === 'in' ? 'var(--mint)' : 'var(--flare)' }}>{usd(e.usd)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {!rows.length && <p className="py-6 text-center text-[13px] text-ink-muted">No Smart Money moves of $25K+ stored in this window yet.</p>}
          </div>
        </TimelineFilter>
      </section>
    </div>
  );
}
