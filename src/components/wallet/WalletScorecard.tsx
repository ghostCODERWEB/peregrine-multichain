import Link from 'next/link';
import { TokenLogo } from '@/components/Logo';
import type { Balances, PnlSummary } from '@/server/wallet/wallet-page';
import { traderWorkspace } from '@/server/research/hyperliquid';
import { pmTrader } from '@/server/predict/trader';
import { spotGrade, perpGrade, predictGrade, overallGrade, type Grade } from '@/lib/models/trader-grade';
import { pct, usd } from '@/lib/viz/format';

type Wave<T> = T | { unavailable: string };
const ok = <T,>(w: Wave<T> | null | undefined): w is T => !!w && !('unavailable' in (w as object));
const TONE = { good: 'var(--mint)', mixed: 'var(--amber)', bad: 'var(--flare)' } as const;
const STABLE = /^(usdc|usdt|dai|usde|fdusd|pyusd|usds|usdc\.e|usdt0|susde|rlusd)$/i;
const sgn = (v: number | null | undefined) => usd(v, { signed: true });
const col = (v: number | null | undefined) => (v == null ? undefined : { color: v >= 0 ? 'var(--mint)' : 'var(--flare)' });

function Ring({ g, size = 64 }: { g: Grade | null; size?: number }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r, color = g ? TONE[g.tone] : 'var(--hair-2)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hair)" strokeWidth={5} />
      {g && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${(g.score / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />}
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" className="num font-bold" fontSize={size * 0.3} fill={g ? color : 'var(--ink-muted)'}>{g ? g.score : '–'}</text>
    </svg>
  );
}

function Stat({ k, v, style }: { k: string; v: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="min-w-0"><dt className="truncate text-[11px] text-ink-muted">{k}</dt><dd className="num truncate text-[13.5px] font-semibold text-ink" style={style}>{v}</dd></div>;
}

function Market({ title, href, g, empty, stats, holding }: { title: string; href?: string; g: Grade | null; empty: string; stats: Array<[string, React.ReactNode, React.CSSProperties?]>; holding: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[var(--r-inner)] border border-[var(--hair)] p-3.5">
      <div className="flex items-center gap-3">
        <Ring g={g} size={52} />
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-ink">{href ? <a href={href} className="hover:underline">{title}</a> : title}</h3>
          <p className="text-[12px] font-semibold" style={{ color: g ? TONE[g.tone] : 'var(--ink-muted)' }}>{g ? g.verdict : empty}</p>
          {g && <p className="text-[11px] text-ink-muted">{g.basis}</p>}
        </div>
      </div>
      {stats.length > 0 && <dl className="mt-3 grid grid-cols-3 gap-2">{stats.map(([k, v, s]) => <Stat key={k} k={k} v={v} style={s} />)}</dl>}
      <div className="mt-3 border-t border-[var(--hair)] pt-2.5 text-[12px]">{holding}</div>
    </div>
  );
}

/** The wallet at a glance: is it a good trader, market by market, and what does it hold right now in spot, perps and prediction markets. */
export async function WalletScorecard({ address, balP, pnlP }: { address: string; balP: Promise<Wave<Balances>>; pnlP: Promise<Wave<PnlSummary>> }) {
  const evm = /^0x[a-fA-F0-9]{40}$/.test(address);
  const [b, p, hl, pm] = await Promise.all([
    balP.catch(() => null), pnlP.catch(() => null),
    evm ? traderWorkspace(address).catch(() => null) : Promise.resolve(null),
    evm ? pmTrader(address).catch(() => null) : Promise.resolve(null),
  ]);

  const spot = ok(p) ? spotGrade({ realizedUsd: p.realizedUsd, realizedPct: p.realizedPct != null ? p.realizedPct / 100 : null, winRate: p.winRate, exits: p.exits }) : null;
  const perps = perpGrade(hl?.stats ?? null);
  const predict = predictGrade(pm?.summary ?? null);
  const overall = overallGrade([
    { grade: spot, weight: ok(p) ? Math.max(1, Math.abs(p.realizedUsd)) : 0 },
    { grade: perps, weight: hl?.stats ? Math.max(1, Math.abs(hl.stats.realizedPnl)) : 0 },
    { grade: predict, weight: pm?.summary ? Math.max(1, Math.abs((pm.summary.realizedUsd ?? 0) + (pm.summary.unrealizedUsd ?? 0))) : 0 },
  ]);

  const tokens = ok(b) ? [...b.positions].sort((x, y) => y.valueUsd - x.valueUsd).filter((x) => !STABLE.test(x.symbol)).slice(0, 4) : [];
  const positions = hl && Array.isArray(hl.positions) ? hl.positions : [];
  const openMarkets = (pm?.markets ?? []).filter((m) => !m.resolved);
  const acct = hl?.account?.valueUsd ?? null;
  const headline = overall
    ? `${overall.verdict}${[spot && 'spot', perps && 'perps', predict && 'predictions'].filter(Boolean).length > 1 ? ' across markets' : ''}`
    : 'Not enough trades to grade';

  return (
    <section aria-labelledby="scorecard" className="material p-4 sm:p-5 xl:col-span-12">
      <div className="flex flex-wrap items-center gap-4">
        <Ring g={overall} size={76} />
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-semibold uppercase tracking-wider text-ink-muted">Trader score</p>
          <h2 id="scorecard" className="text-[20px] font-bold tracking-[-0.01em]" style={{ color: overall ? TONE[overall.tone] : 'var(--ink-1)' }}>{headline}</h2>
          <p className="num text-[12.5px] text-ink-2">
            Net worth {ok(b) ? usd(b.totalUsd) : 'n/a'}{acct != null && acct > 0 ? ` · Hyperliquid ${usd(acct)}` : ''}{pm?.summary ? ` · Polymarket PnL ${sgn((pm.summary.realizedUsd ?? 0) + (pm.summary.unrealizedUsd ?? 0))}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Market title="Spot" href="#allocation" g={spot} empty="Too few exits to grade"
          stats={ok(p) ? [['Realized 30D', sgn(p.realizedUsd), col(p.realizedUsd)], ['Win rate', pct(p.winRate, 0)], ['Tokens', String(p.tokens ?? 'n/a')]] : []}
          holding={tokens.length ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-ink-muted">Holds</span>
              {tokens.map((t) => <Link key={`${t.chain}:${t.tokenAddress}`} href={`/token/${t.chain}/${encodeURIComponent(t.tokenAddress)}`} className="inline-flex items-center gap-1 hover:underline"><TokenLogo symbol={t.symbol} chain={t.chain} address={t.tokenAddress} size={14} /><span className="font-semibold text-ink">{t.symbol}</span><span className="num text-ink-muted">{usd(t.valueUsd)}</span></Link>)}
            </div>
          ) : <span className="text-ink-muted">No priced non-stable holdings.</span>} />

        <Market title="Perps · Hyperliquid" href="#hyperliquid" g={perps} empty={evm ? 'No closed perp trades in 30 days' : 'Hyperliquid accounts are EVM addresses'}
          stats={hl?.stats ? [['Realized 30D', sgn(hl.stats.realizedPnl), col(hl.stats.realizedPnl)], ['Win rate', pct(hl.stats.winRate, 0)], ['Profit factor', hl.stats.profitFactor == null ? 'n/a' : hl.stats.profitFactor.toFixed(2)]] : []}
          holding={positions.length ? (
            <div className="space-y-1">
              <div className="num flex justify-between text-ink-muted"><span>{positions.length} open · net {sgn(hl!.exposure.netUsd)}</span><span style={col(hl!.exposure.upnlUsd)}>uPnL {sgn(hl!.exposure.upnlUsd)}</span></div>
              {positions.slice(0, 3).map((x) => (
                <div key={x.coin} className="num flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5"><TokenLogo symbol={x.coin} coin={x.coin} size={14} /><span className="font-semibold text-ink">{x.coin}</span><span style={{ color: x.side === 'long' ? 'var(--mint)' : 'var(--flare)' }}>{x.side}{x.leverage ? ` ${x.leverage}×` : ''}</span></span>
                  <span className="text-ink-2">{usd(x.valueUsd)} · <span style={col(x.upnlUsd)}>{sgn(x.upnlUsd)}</span>{x.distanceToLiq != null ? <span className="text-ink-muted"> · liq {pct(x.distanceToLiq, 0)} away</span> : null}</span>
                </div>
              ))}
            </div>
          ) : <span className="text-ink-muted">No open perp positions.</span>} />

        <Market title="Predictions · Polymarket" href="#pm-trader" g={predict} empty={evm ? 'No Polymarket record' : 'Polymarket accounts are EVM addresses'}
          stats={pm?.summary ? [['Lifetime PnL', sgn((pm.summary.realizedUsd ?? 0) + (pm.summary.unrealizedUsd ?? 0)), col((pm.summary.realizedUsd ?? 0) + (pm.summary.unrealizedUsd ?? 0))], ['Win rate', pct(pm.summary.winRate, 0)], ['Markets', String(pm.summary.marketsTraded ?? 'n/a')]] : []}
          holding={openMarkets.length ? (
            <div className="space-y-1"><span className="text-ink-muted">{openMarkets.length} open market{openMarkets.length > 1 ? 's' : ''}</span>
              {openMarkets.slice(0, 3).map((m) => (
                <div key={m.id ?? m.question} className="flex items-baseline justify-between gap-2">
                  {m.id ? <Link href={`/predict/${encodeURIComponent(m.id)}`} className="min-w-0 truncate text-ink hover:underline">{m.side ? <b>{m.side} · </b> : null}{m.question}</Link> : <span className="min-w-0 truncate text-ink">{m.question}</span>}
                  <span className="num shrink-0" style={col(m.pnlUsd)}>{sgn(m.pnlUsd)}</span>
                </div>
              ))}
            </div>
          ) : <span className="text-ink-muted">No open prediction positions.</span>} />
      </div>
    </section>
  );
}
