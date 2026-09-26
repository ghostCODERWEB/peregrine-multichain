import Link from 'next/link';
import { AddressLink } from '@/components/entity/AddressLink';
import { StatStrip } from '@/components/StatStrip';
import { TimelineFilter } from './TimelineFilter';
import { getDb } from '@/server/nansen/db';
import { perpChanges } from '@/server/perps/terminal';
import { chainName, pct, usd } from '@/lib/viz/format';

type Ev = { at: number; kind: 'spot' | 'perp'; wallet: string; label: string | null; verb: string; tone: 'in' | 'out'; what: React.ReactNode; usd: number };

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
    .map((r) => ({ at: r.at, kind: 'spot', wallet: r.wallet, label: r.label, verb: r.side === 'buy' ? 'bought' : 'sold', tone: r.side === 'buy' ? 'in' : 'out', usd: r.v,
      what: <Link href={`/token/${r.chain}/${encodeURIComponent(r.t)}`} className="font-semibold text-ink hover:underline">{r.s ?? r.t.slice(0, 6)} <span className="font-normal text-ink-muted">on {chainName(r.chain)}</span></Link> }));
  for (const sym of ['BTC', 'ETH']) {
    const c = perpChanges(sym, 3_600_000);
    if ('unavailable' in c) continue;
    for (const ch of c.changes.filter((x) => x.cohorts.includes('smart_money') && x.kind !== 'left-set').slice(0, 20)) {
      const verb = ch.kind === 'flipped' ? `flipped to ${ch.side}` : ch.kind === 'increased' ? `added to ${ch.side}` : ch.kind === 'reduced' ? `reduced ${ch.side}` : `${ch.kind} ${ch.side}`;
      events.push({ at: c.to, kind: 'perp', wallet: ch.address, label: ch.label, verb, tone: ch.deltaUsd >= 0 === (ch.side === 'long') ? 'in' : 'out', usd: Math.abs(ch.deltaUsd),
        what: <Link href={`/perps/${sym}?tab=changes`} className="font-semibold text-ink hover:underline">{sym} perp</Link> });
    }
  }
  events.sort((a, b) => b.at - a.at);

  return (
    <div className="space-y-4">
      <StatStrip className="rise" stats={[
        { label: 'Smart Money DEX net, 24h', value: usd(net, { signed: true }), tone: net >= 0 ? 'in' : 'out', note: prevNet ? `prior 24h ${usd(prevNet, { signed: true })}` : undefined },
        { label: 'Inflow / outflow', value: `${usd(cur.inflow)} / ${usd(cur.outflow)}`, note: `${cur.w} wallets${prev.w ? ` (prior ${prev.w})` : ''}` },
        { label: 'Most accumulated', value: acc && acc.net > 0 ? `${acc.s ?? '?'} ${usd(acc.net, { signed: true })}` : 'n/a', note: acc ? `${acc.w} wallets · ${chainName(acc.chain)}` : undefined, href: acc && `/token/${acc.chain}/${encodeURIComponent(acc.t)}`, tone: 'in' },
        { label: 'Most distributed', value: dis && dis.net < 0 ? `${dis.s ?? '?'} ${usd(dis.net, { signed: true })}` : 'n/a', note: dis ? `${dis.w} wallets · ${chainName(dis.chain)}` : undefined, href: dis && `/token/${dis.chain}/${encodeURIComponent(dis.t)}`, tone: 'out' },
        { label: 'Most active chain', value: chains ? chainName(chains.chain) : 'n/a', note: chains ? `${usd(chains.v)} traded · ${pct(chains.v / Math.max(1, (cur.inflow ?? 0) + (cur.outflow ?? 0)), 0)} of volume` : undefined, href: chains && `/chain/${chains.chain}` },
      ]} />
      <section aria-labelledby="sm-timeline" className="material p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sm-timeline" className="t-section">Smart Money timeline</h2>
          <span className="text-[12px] text-ink-muted">DEX trades ≥ $25K (24h) and perp position changes (latest hour, BTC and ETH), newest first</span>
        </div>
        <TimelineFilter>
          <ol className="max-h-[420px] divide-y divide-[var(--hair)] overflow-y-auto" tabIndex={0} aria-label="Timeline">
            {events.slice(0, 80).map((e, i) => (
              <li key={i} data-kind={e.kind} className="flex items-center gap-3 py-1.5 text-[12.5px]">
                <span className="num w-[86px] shrink-0 text-ink-muted">{new Date(e.at).toISOString().slice(5, 16).replace('T', ' ')}</span>
                <span className={`w-11 shrink-0 rounded-[5px] px-1.5 text-center text-[10.5px] font-bold ${e.kind === 'perp' ? 'bg-[color-mix(in_srgb,var(--signal)_16%,transparent)] text-[var(--signal)]' : 'bg-ink/10 text-ink-2'}`}>{e.kind === 'perp' ? 'PERP' : 'SPOT'}</span>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate"><AddressLink address={e.wallet} label={e.label} compact /> <span className="text-ink-2">{e.verb}</span> {e.what}</span>
                <span className="num shrink-0 font-semibold" style={{ color: e.tone === 'in' ? 'var(--mint)' : 'var(--flare)' }}>{usd(e.usd)}</span>
              </li>
            ))}
            {!events.length && <li className="py-6 text-center text-[13px] text-ink-muted">No Smart Money events stored in this window; the scanner and perp terminal fill this.</li>}
          </ol>
        </TimelineFilter>
      </section>
    </div>
  );
}
