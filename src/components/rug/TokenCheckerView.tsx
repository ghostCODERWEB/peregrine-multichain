import Link from 'next/link';
import { TokenLogo } from '@/components/Logo';
import type { CheckerData, ScoredToken, UniverseToken } from '@/server/token/checker';
import { chainName, pct, usd } from '@/lib/viz/format';

// One wording everywhere (table, verdict, phone): Danger 55+, Watch 35+, Low below.
const LEVELS = [['danger', 'Danger', 'var(--flare)'], ['watch', 'Watch', 'var(--amber)'], ['low', 'Low', 'var(--mint)']] as const;
const levelOf = (score: number) => (score >= 55 ? LEVELS[0] : score >= 35 ? LEVELS[1] : LEVELS[2]);
const COLS: Array<[string, string]> = [['concentration', 'Top-10'], ['exitLiquidity', 'Exit liq.'], ['sellPressure', 'Sell pressure'], ['insider', 'Insiders'], ['windShear', 'Momentum']];
const heat = (v: number | null) => (v == null ? 'transparent' : `color-mix(in srgb, ${v >= 70 ? 'var(--flare)' : v >= 50 ? 'var(--amber)' : 'var(--mint)'} ${Math.round(12 + (Math.abs(v - 50) / 50) * 38)}%, transparent)`);
const href = (t: { chain: string; address: string }) => `/token/${t.chain}/${encodeURIComponent(t.address)}`;
const tone = (v: number | null | undefined) => ({ color: (v ?? 0) >= 0 ? 'var(--mint)' : 'var(--flare)' });
const px = (v: number | null) => (v == null ? 'n/a' : v >= 1 ? `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : `$${v.toPrecision(3)}`);

function Tok({ t, sym }: { t: { chain: string; address: string }; sym: string | null }) {
  return <Link prefetch={false} href={href(t)} className="flex items-center gap-2 font-semibold text-ink hover:underline"><TokenLogo symbol={sym} chain={t.chain} address={t.address} size={18} />{sym ?? t.address.slice(0, 6)}<span className="font-normal text-ink-muted">{chainName(t.chain)}</span></Link>;
}
function ScoreCell({ s }: { s: ScoredToken }) {
  const [, band, color] = levelOf(s.score);
  return <span className="flex items-center gap-2"><span className="num w-6 font-bold text-ink">{Math.round(s.score)}</span><span className="h-1.5 w-14 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full" style={{ width: `${s.score}%`, background: color }} /></span><span className="text-[11px] font-semibold" style={{ color }}>{band}</span></span>;
}

/** Token Checker: every scored token, the traded universe, new tokens, and Smart Money buying into risk. */
export function TokenCheckerView({ d }: { d: CheckerData }) {
  const bands = [...LEVELS].reverse().map(([b, label, color]) => ({ b, label, color, n: d.scored.filter((s) => levelOf(s.score)[0] === b).length }));
  const maxB = Math.max(1, ...bands.map((x) => x.n));
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*]:min-w-0">
      <section aria-labelledby="scored" className="material p-4 sm:p-5 xl:col-span-9">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="scored" className="t-section">Risk Scores, last 7 days <span className="text-[11px] font-normal text-ink-muted">0 safest, 100 riskiest</span></h2>
        </div>
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Risk scores">
          <table data-sortable className="w-full min-w-[980px] text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-2 font-normal">Token</th><th className="font-normal">Risk Score</th><th className="text-right font-normal">Nansen risk</th><th className="text-right font-normal">Peregrine risk</th>{COLS.map(([, l]) => <th key={l} className="text-center font-normal">{l}</th>)}<th className="text-right font-normal">Market cap</th><th className="text-right font-normal">Scored</th></tr></thead>
            <tbody>
              {d.scored.map((s) => (
                <tr key={`${s.chain}:${s.address}`} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                  <td className="py-1.5 pr-3"><Tok t={s} sym={s.symbol} /></td>
                  <td className="pr-3"><ScoreCell s={s} /></td>
                  <td className="num text-right text-ink-2">{s.nansen != null ? Math.round(s.nansen) : 'n/a'}</td>
                  <td className="num text-right text-ink-2">{s.peregrine != null ? Math.round(s.peregrine) : 'n/a'}</td>
                  {COLS.map(([k]) => <td key={k} className="num px-0.5 text-center"><span className="block rounded-[4px] py-1 text-ink" style={{ background: heat(s.sub[k] ?? null) }}>{s.sub[k] == null ? '·' : Math.round(s.sub[k]!)}</span></td>)}
                  <td className="num text-right text-ink-2">{usd(s.marketCap)}</td>
                  <td className="num text-right text-ink-muted">{Math.max(1, Math.round((Date.now() - s.at) / 3_600_000))}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!d.scored.length && <p className="py-4 text-[12.5px] text-ink-muted">No tokens scored in the last 7 days. Open any token to score it.</p>}
      </section>

      <div className="space-y-4 xl:col-span-3">
        <section className="material p-4 sm:p-5">
          <h2 className="t-section mb-3">Score distribution</h2>
          <ul className="space-y-2">
            {bands.map(({ b, n, label, color }) => { return (
              <li key={b} className="grid grid-cols-[72px_minmax(0,1fr)_28px] items-center gap-2 text-[12px]"><span className="font-semibold" style={{ color }}>{label}</span><span className="h-2 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full" style={{ width: `${(n / maxB) * 100}%`, background: color }} /></span><span className="num text-right text-ink-2">{n}</span></li>
            ); })}
          </ul>
        </section>
        {d.smIntoRisk.length > 0 && (
          <section id="sm-risk" className="material scroll-mt-20 p-4 sm:p-5">
            <h2 className="t-section mb-1">Smart Money buying risk</h2>
            <p className="mb-2 text-[11.5px] text-ink-muted">Net Smart Money buys, 24h, into tokens scoring 50 or more</p>
            <ol className="space-y-1.5">
              {d.smIntoRisk.slice(0, 8).map((r) => (
                <li key={`${r.chain}:${r.address}`} className="flex items-center gap-2 text-[12px]"><span className="min-w-0 flex-1 truncate"><Tok t={r} sym={r.symbol} /></span><span className="num font-semibold" style={{ color: 'var(--mint)' }}>{usd(r.net, { signed: true })}</span><span className="num w-7 text-right font-bold" style={{ color: r.score > 75 ? 'var(--flare)' : 'var(--amber)' }}>{Math.round(r.score)}</span></li>
              ))}
            </ol>
          </section>
        )}
      </div>

      <UniverseTable id="universe" title="Most traded tokens, 24h" sub="All traders, 24h · Vol / liq above 5× means thin pools" rows={d.universe} span="xl:col-span-12" />
      {d.fresh.length > 0 && <UniverseTable id="fresh" title="New tokens" sub="7 days old or younger, most traded first" rows={d.fresh} span="xl:col-span-12" />}
    </div>
  );
}

function UniverseTable({ id, title, sub, rows, span }: { id: string; title: string; sub: string; rows: UniverseToken[]; span: string }) {
  return (
    <section aria-labelledby={id} className={`material p-4 sm:p-5 ${span}`}>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h2 id={id} className="t-section">{title} · {rows.length}</h2><span className="text-[12px] text-ink-muted">{sub}</span></div>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={title}>
        <table data-sortable className="w-full min-w-[980px] text-left text-[12.5px]">
          <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-2 font-normal">Token</th><th className="text-right font-normal">Price</th><th className="text-right font-normal">24h</th><th className="text-right font-normal">Volume</th><th className="text-right font-normal">Liquidity</th><th className="text-right font-normal">Vol / liq</th><th className="text-right font-normal">Market cap</th><th className="text-right font-normal">Age</th><th className="text-right font-normal">Net flow</th>{rows.some((u) => u.smNetflow != null) && <th className="text-right font-normal">SM net flow</th>}<th className="text-right font-normal">Score</th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={`${u.chain}:${u.address}`} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                <td className="py-1.5"><Tok t={u} sym={u.symbol} /></td>
                <td className="num text-right text-ink-2">{px(u.price)}</td>
                <td className="num text-right" style={tone(u.change)}>{u.change != null ? pct(u.change, 1) : 'n/a'}</td>
                <td className="num text-right text-ink">{usd(u.volume)}</td>
                <td className="num text-right text-ink-2">{usd(u.liquidity)}</td>
                <td className="num text-right" style={{ color: (u.turnover ?? 0) > 5 ? 'var(--amber)' : undefined }}>{u.turnover != null ? `${u.turnover.toFixed(1)}×` : 'n/a'}</td>
                <td className="num text-right text-ink-2">{usd(u.marketCap)}</td>
                <td className="num text-right text-ink-2">{u.ageDays != null ? `${Math.round(u.ageDays)}d` : 'n/a'}</td>
                <td className="num text-right" style={tone(u.netflow)}>{u.netflow != null ? usd(u.netflow, { signed: true }) : 'n/a'}</td>
                {rows.some((x) => x.smNetflow != null) && <td className="num text-right" style={u.smNetflow != null ? tone(u.smNetflow) : undefined}>{u.smNetflow != null ? usd(u.smNetflow, { signed: true }) : <span className="text-ink-muted">·</span>}</td>}
                <td className="num text-right font-semibold" style={{ color: u.score == null ? 'var(--ink-muted)' : u.score > 75 ? 'var(--flare)' : u.score > 50 ? 'var(--amber)' : 'var(--mint)' }}>{u.score != null ? Math.round(u.score) : 'n/a'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
