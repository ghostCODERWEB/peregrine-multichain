'use client';
import Link from 'next/link';
import { ChainLogo, TokenLogo } from '@/components/Logo';
import { useMemo, useState } from 'react';
import { Card, Unavailable } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import { TimeAgo } from '@/components/TimeAgo';
import { ScoreRing } from '@/components/viz/ScoreRing';
import { FlowSpark } from '@/components/viz/FlowSpark';
import type { AlphaBoard, AlphaRow } from '@/server/alpha/board';
import { chainName, pct, usd } from '@/lib/viz/format';

const ringColor = (s: number) => (s >= 65 ? 'var(--brand)' : s <= 35 ? 'var(--out-3)' : 'var(--ink-2)');

function Parts({ row, max = 3 }: { row: AlphaRow; max?: number }) {
  return (
    <ul className="flex flex-wrap gap-1">
      {row.parts.slice(0, max).map((p) => (
        <li
          key={p.id}
          title={p.detail}
          className={`rounded-md px-1.5 py-0.5 text-[11px] ${p.points >= 0 ? 'bg-brand/12 text-ink' : 'bg-out-3/15 text-ink'}`}
        >
          <span className="num">
            {p.points > 0 ? '+' : ''}
            {p.points}
          </span>{' '}
          {p.label}
        </li>
      ))}
    </ul>
  );
}

function Leader({ row, rank }: { row: AlphaRow; rank: number }) {
  return (
    <Link
      href={`/token/${row.chain}/${encodeURIComponent(row.tokenAddress)}`}
      className="material rise group flex gap-4 p-5 transition-colors hover:border-brand/30"
    >
      <ScoreRing
        score={row.score}
        size={76}
        stroke={7}
        color={ringColor(row.score)}
        label={`${row.symbol ?? 'Token'} alpha score`}
        sublabel="alpha"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2 truncate text-[15px] font-semibold sm:text-[17px] text-ink group-hover:underline">
            <TokenLogo symbol={row.symbol} logo={row.logo} chain={row.chain} address={row.tokenAddress} size={20} />
            {row.symbol ?? 'Token'}
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
            #{rank} · <ChainLogo chain={row.chain} size={12} />
            {chainName(row.chain)}
          </span>
        </div>
        <div className="num mt-0.5 text-[12px] text-ink-2">
          {row.flowShare != null ? `${pct(row.flowShare, 1)} net buying` : 'n/a'} · {usd(row.volume24hUsd)} vol · {usd(row.liquidityUsd)} liq
        </div>
        {row.hourly.filter((v) => v != null).length > 1 && (
          <div className="mt-2">
            <FlowSpark values={row.hourly} width={160} height={24} label="Hourly net-flow share" />
          </div>
        )}
        <ul className="mt-2 hidden space-y-0.5 text-[12px] text-ink-2 sm:block">
          {row.parts.slice(0, 3).map((p) => (
            <li key={p.id}>
              <span className={`num ${p.points >= 0 ? 'text-brand' : 'text-out-3'}`}>
                {p.points > 0 ? '+' : ''}
                {p.points}
              </span>{' '}
              {p.label} · <span className="text-ink-muted">{p.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}

/** The board: three leaders, then everything else, filterable by chain. */
export function AlphaView({ board }: { board: AlphaBoard }) {
  const [chain, setChain] = useState<string>('all');
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of board.rows) m.set(r.chain, (m.get(r.chain) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [board.rows]);
  const rows = chain === 'all' ? board.rows : board.rows.filter((r) => r.chain === chain);

  if (board.unavailable) return <Unavailable text={board.unavailable} />;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {rows.slice(0, 3).map((r, i) => (
          <Leader key={`${r.chain}:${r.tokenAddress}`} row={r} rank={i + 1} />
        ))}
      </div>
      <Card
        id="alpha-board"
        title={`${rows.length} tokens worth a look${chain === 'all' ? ' across every chain' : ` on ${chainName(chain)}`}`}
        sub={
          <>
            Scored from the scanner&apos;s token snapshots (updated <TimeAgo ts={board.at} />
            ). Hover a reason for its numbers.
          </>
        }
        action={board.provenance ? <InfoPopover p={board.provenance} /> : undefined}
      >
        <div className="chip-row -mx-1 mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by chain">
          {[['all', board.rows.length] as const, ...counts].map(([c, n]) => (
            <button
              key={c}
              role="tab"
              aria-selected={chain === c}
              onClick={() => setChain(c)}
              className={`rounded border px-2.5 py-1 text-[12px] ${chain === c ? 'border-brand/40 bg-brand/12 text-ink' : 'border-border text-ink-2 hover:bg-accent hover:text-ink'}`}
            >
              {c === 'all' ? (
                'All chains'
              ) : (
                <span className="inline-flex items-center gap-1">
                  <ChainLogo chain={c} size={13} />
                  {chainName(c)}
                </span>
              )}{' '}
              <span className="num text-ink-muted">{n}</span>
            </button>
          ))}
        </div>
        <div tabIndex={0} role="region" aria-label="Alpha board" className="overflow-x-auto">
          <table data-sortable className="w-full min-w-[760px] text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="py-2 pr-2 font-normal">Score</th>
                <th className="py-2 pr-2 font-normal">Token</th>
                <th className="py-2 pr-2 text-right font-normal">Net buying</th>
                <th className="py-2 pr-2 font-normal">Last 12 scans</th>
                <th className="py-2 pr-2 text-right font-normal">24h</th>
                <th className="py-2 pr-2 text-right font-normal">Liquidity</th>
                <th className="py-2 pr-2 text-right font-normal">Mkt cap</th>
                <th className="py-2 font-normal">Why</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.chain}:${r.tokenAddress}`} className="border-b border-border/50 hover:bg-accent/40">
                  <td className="py-1.5 pr-2">
                    <ScoreRing
                      score={r.score}
                      size={34}
                      stroke={3.5}
                      color={ringColor(r.score)}
                      label={`${r.symbol ?? 'Token'} alpha score`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <Link
                      href={`/token/${r.chain}/${encodeURIComponent(r.tokenAddress)}`}
                      className="inline-flex items-center gap-1.5 font-medium text-ink hover:underline"
                    >
                      <TokenLogo symbol={r.symbol} logo={r.logo} chain={r.chain} address={r.tokenAddress} size={16} />
                      {r.symbol ?? 'Token'}
                    </Link>
                    <div className="flex items-center gap-1 text-[11px] text-ink-muted">
                      <ChainLogo chain={r.chain} size={12} />
                      {chainName(r.chain)}
                    </div>
                  </td>
                  <td className="num py-1.5 pr-2 text-right" style={{ color: (r.flowShare ?? 0) >= 0 ? 'var(--in-3)' : 'var(--out-3)' }}>
                    {r.flowShare != null ? pct(r.flowShare, 1) : 'n/a'}
                  </td>
                  <td className="py-1.5 pr-2">
                    <FlowSpark values={r.hourly} label={`${r.symbol ?? 'Token'} hourly net-flow share`} />
                  </td>
                  <td className="num py-1.5 pr-2 text-right text-ink-2">{r.priceChange24h != null ? pct(r.priceChange24h, 1) : 'n/a'}</td>
                  <td className="num py-1.5 pr-2 text-right text-ink-2">{usd(r.liquidityUsd)}</td>
                  <td className="num py-1.5 pr-2 text-right text-ink-2">{usd(r.marketCapUsd)}</td>
                  <td className="py-1.5">
                    <Parts row={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
