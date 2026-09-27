import Link from 'next/link';
import { properAddress } from '@/server/nansen/address-case';
import { TokenLogo } from '@/components/Logo';
import { getDb } from '@/server/nansen/db';
import { chainName, usd } from '@/lib/viz/format';

const COLS: Array<[string, string]> = [['concentration', 'Top-10'], ['exitLiquidity', 'Exit liq.'], ['sellPressure', 'Sell pressure'], ['insider', 'Insiders'], ['nansenRisk', 'Nansen risk'], ['windShear', 'Momentum']];
const BAND: Record<string, [string, string]> = { warning: ['Critical', 'var(--flare)'], watch: ['High', 'var(--amber)'], cloudy: ['Moderate', 'var(--signal)'], clear: ['Low', 'var(--mint)'] };
const heat = (v: number | null) => (v == null ? 'transparent' : `color-mix(in srgb, ${v >= 70 ? 'var(--flare)' : v >= 50 ? 'var(--amber)' : 'var(--mint)'} ${Math.round(12 + (Math.abs(v - 50) / 50) * 38)}%, transparent)`);

/** The latest Dump Risk reading per scored token (last 7 days), highest first, with each input as a heat cell. */
export function RiskBoard() {
  const rows = getDb().prepare(`SELECT s.chain, s.token_address AS t, s.symbol, s.score, s.band, s.sub_scores AS sub, s.market_cap_usd AS mcap, s.computed_at AS at
    FROM storm_scores s JOIN (SELECT chain, token_address, MAX(computed_at) m FROM storm_scores WHERE computed_at >= ? GROUP BY chain, token_address) x
    ON x.chain = s.chain AND x.token_address = s.token_address AND x.m = s.computed_at AND COALESCE(s.symbol, '') <> '' ORDER BY s.score DESC LIMIT 40`).all(Date.now() - 7 * 86_400_000) as Array<{ chain: string; t: string; symbol: string | null; score: number; band: string; sub: string; mcap: number | null; at: number }>;
  if (!rows.length) return null;
  return (
    <section aria-labelledby="riskboard" className="material p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="riskboard" className="t-section">Highest dump risk, last 7 days</h2>
        <span className="num text-[12px] text-ink-muted">{rows.length} tokens · {rows.filter((r) => r.band === 'warning' || r.band === 'watch').length} High or Critical</span>
      </div>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Dump risk board">
        <table data-sortable className="w-full min-w-[860px] text-left text-[12.5px]">
          <thead className="text-[11px] uppercase tracking-wider text-ink-muted">
            <tr><th className="py-2 font-normal">Token</th><th className="font-normal">Score</th>{COLS.map(([, l]) => <th key={l} className="text-center font-normal">{l}</th>)}<th className="text-right font-normal">Market cap</th><th className="text-right font-normal">Scored</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sub = JSON.parse(r.sub) as Record<string, number | null>;
              const addr = properAddress(r.chain, r.t);
              const [band, color] = BAND[r.band] ?? [r.band, 'var(--ink-2)'];
              return (
                <tr key={`${r.chain}:${r.t}`} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                  <td className="py-1.5 pr-3">
                    <Link prefetch={false} href={`/token/${r.chain}/${encodeURIComponent(addr)}`} className="flex items-center gap-2 font-semibold text-ink hover:underline">
                      <TokenLogo symbol={r.symbol} chain={r.chain} address={addr} size={18} />{r.symbol ?? r.t.slice(0, 6)}<span className="font-normal text-ink-muted">{chainName(r.chain)}</span>
                    </Link>
                  </td>
                  <td className="pr-3">
                    <span className="flex items-center gap-2">
                      <span className="num w-6 font-bold text-ink">{Math.round(r.score)}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full" style={{ width: `${r.score}%`, background: color }} /></span>
                      <span className="text-[11px] font-semibold" style={{ color }}>{band}</span>
                    </span>
                  </td>
                  {COLS.map(([k]) => <td key={k} className="num px-0.5 text-center"><span className="block rounded-[4px] py-1 text-ink" style={{ background: heat(sub[k] ?? null) }}>{sub[k] == null ? '·' : Math.round(sub[k]!)}</span></td>)}
                  <td className="num text-right text-ink-2">{usd(r.mcap)}</td>
                  <td className="num text-right text-ink-muted">{Math.max(1, Math.round((Date.now() - r.at) / 3_600_000))}h</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
