import Link from 'next/link';
import { Card } from '@/components/Card';
import { TokenLogo, ChainLogo } from '@/components/Logo';
import { AllocationTreemap, RankBars } from '@/components/charts/IntelCharts';
import type { Balances, PnlSummary } from '@/server/wallet/wallet-page';
import { chainName, pct, usd } from '@/lib/viz/format';

const STABLES = new Set(['USDC', 'USDT', 'DAI', 'USDE', 'FDUSD', 'PYUSD', 'USDS', 'TUSD', 'USDC.E', 'USDB', 'USD0', 'GHO', 'CRVUSD', 'FRAX', 'LUSD', 'SUSDE', 'USDT0', 'USDBC', 'RLUSD']);
type Wave<T> = T | { unavailable: string };
const ok = <T,>(w: Wave<T> | null): w is T => !!w && !('unavailable' in (w as object));

/** The wallet's portfolio inside the Profiler: value, concentration, stablecoin share, allocation by chain and asset, every holding, and where realized PnL came from. */
export async function WalletPortfolio({ balP, pnlP }: { balP: Promise<Wave<Balances>>; pnlP: Promise<Wave<PnlSummary>> }) {
  const [b, p] = await Promise.all([balP.catch(() => null), pnlP.catch(() => null)]);
  if (!ok(b)) return <section className="material p-4 text-[13px] text-ink-muted xl:col-span-12">{b && 'unavailable' in b ? b.unavailable : 'Balances unavailable.'}</section>;
  const total = b.totalUsd || 1;
  const pos = [...b.positions].sort((x, y) => y.valueUsd - x.valueUsd);
  const stable = pos.filter((x) => STABLES.has(x.symbol.toUpperCase())).reduce((a, x) => a + x.valueUsd, 0);
  const shares = pos.map((x) => x.valueUsd / total);
  const hhi = shares.reduce((a, s) => a + s * s, 0);
  const top5 = shares.slice(0, 5).reduce((a, s) => a + s, 0);
  const href = (x: { chain: string; tokenAddress: string }) => `/token/${x.chain}/${encodeURIComponent(x.tokenAddress)}`;
  const tiles: Array<[string, string, string?, string?]> = [
    ['Net worth', usd(b.totalUsd), `${pos.length} priced assets`],
    ['Chains', String(b.byChain.length), b.byChain[0] ? `${chainName(b.byChain[0].chain)} ${pct(b.byChain[0].valueUsd / total, 0)}` : undefined],
    ['Largest holding', pos[0] ? `${pos[0].symbol} ${pct(shares[0], 0)}` : 'n/a', pos[0] ? usd(pos[0].valueUsd) : undefined],
    ['Top 5 share', pct(top5, 0), 'of net worth'],
    ['Effective positions', hhi ? (1 / hhi).toFixed(1) : 'n/a', '1 ÷ Σ share² (concentration)'],
    ['Stablecoins', pct(stable / total, 0), usd(stable)],
    ['Realized PnL', ok(p) ? usd(p.realizedUsd, { signed: true }) : 'n/a', ok(p) ? `${pct(p.realizedPct / 100, 1)} return · Nansen` : undefined, ok(p) ? (p.realizedUsd >= 0 ? 'var(--mint)' : 'var(--flare)') : undefined],
    ['Win rate', ok(p) && p.winRate != null ? pct(p.winRate, 0) : 'n/a', ok(p) ? `${p.tokens} tokens traded` : undefined],
  ];
  const attribution = ok(p) ? p.top.map((t) => ({ label: t.symbol, value: t.pnlUsd ?? 0, href: `/token/${t.chain}/${encodeURIComponent(t.tokenAddress)}`, sub: `ROI ${pct(t.roi, 0)} · ${chainName(t.chain)}` })) : [];
  return (
    <>
      <ul aria-label="Portfolio" className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-inner)] border border-[var(--hair)] bg-[var(--hair)] sm:grid-cols-4 xl:col-span-12 xl:grid-cols-8">
        {tiles.map(([k, v, note, color]) => <li key={k} className="min-w-0 bg-[var(--surface-1)] px-3 py-2"><span className="block truncate text-[11px] font-semibold text-ink-muted">{k}</span><span className="num block truncate text-[16px] font-bold text-ink" style={color ? { color } : undefined}>{v}</span>{note && <span className="block truncate text-[10.5px] text-ink-2">{note}</span>}</li>)}
      </ul>
        <Card id="allocation" className="xl:col-span-7" title="Allocation" sub="Chains, then assets · area is USD value · select a tile for the token">
          <AllocationTreemap items={pos.slice(0, 60).map((x) => ({ chain: x.chain, symbol: x.symbol, href: href(x), value: x.valueUsd, share: x.valueUsd / total }))} />
        </Card>
          <Card id="chain-allocation" className="xl:col-span-5" title={`By chain · ${b.byChain.length}`}>
            <ul className="space-y-1.5">
              {b.byChain.slice(0, 14).map((ch) => (
                <li key={ch.chain} className="grid grid-cols-[minmax(0,1fr)_90px_64px] items-center gap-2 text-[12px]">
                  <Link href={`/chain/${ch.chain}`} className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-ink hover:underline"><ChainLogo chain={ch.chain} size={14} />{chainName(ch.chain)}<span className="font-normal text-ink-muted">{ch.tokens}</span></Link>
                  <span className="h-1.5 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full bg-[var(--signal)]" style={{ width: `${(ch.valueUsd / total) * 100}%` }} /></span>
                  <span className="num text-right text-ink-2">{usd(ch.valueUsd)}</span>
                </li>
              ))}
            </ul>
          </Card>
      <Card id="holdings" className={attribution.length ? 'xl:col-span-7' : 'xl:col-span-12'} title={`Holdings · ${pos.length}`} sub="Sort by any column · the token opens its page, Risk report opens its risk checklist">
        <div className="max-h-[440px] overflow-auto" tabIndex={0} role="region" aria-label="Holdings">
          <table data-sortable className="w-full min-w-[640px] text-left text-[12.5px]">
            <thead className="sticky top-0 bg-[var(--surface-1)] text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-2 font-normal">Asset</th><th className="font-normal">Chain</th><th className="text-right font-normal">Balance</th><th className="text-right font-normal">Price</th><th className="text-right font-normal">Value</th><th className="text-right font-normal">Share</th><th className="text-right font-normal">Risk</th></tr></thead>
            <tbody>
              {pos.map((x) => (
                <tr key={`${x.chain}:${x.tokenAddress}`} className="border-t border-[var(--hair)] hover:bg-[var(--surface-2)]">
                  <td className="py-1.5"><Link href={href(x)} className="flex items-center gap-2 font-semibold text-ink hover:underline"><TokenLogo symbol={x.symbol} chain={x.chain} address={x.tokenAddress} size={18} />{x.symbol}{STABLES.has(x.symbol.toUpperCase()) && <span className="rounded bg-ink/8 px-1 text-[9.5px] font-bold text-ink-muted">STABLE</span>}</Link></td>
                  <td className="text-ink-2">{chainName(x.chain)}</td>
                  <td className="num text-right text-ink-2">{x.amount != null ? x.amount.toLocaleString('en-US', { maximumFractionDigits: 4 }) : 'n/a'}</td>
                  <td className="num text-right text-ink-2">{x.amount ? usd(x.valueUsd / x.amount) : 'n/a'}</td>
                  <td className="num text-right font-semibold text-ink">{usd(x.valueUsd)}</td>
                  <td className="num text-right text-ink-2">{pct(x.valueUsd / total, 1)}</td>
                  <td className="text-right"><Link href={`/rug/${x.chain}/${encodeURIComponent(x.tokenAddress)}`} className="text-[11.5px] font-semibold text-ink-muted hover:text-ink" title={`${x.symbol} risk report`}>Risk report</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {attribution.length > 0 && <Card id="pnl-attribution" className="xl:col-span-5" title="Where realized PnL came from" sub="Top tokens by realized PnL (Nansen)"><RankBars rows={attribution} label="Realized PnL by token" /></Card>}
    </>
  );
}
