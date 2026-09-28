import Link from 'next/link';
import { LargeTitle, Group, List, Row } from '@/components/mobile/kit';
import { TokenLogo } from '@/components/Logo';
import { TimeAgo } from '@/components/TimeAgo';
import type { Leaders, Timeframe } from '@/server/copy/leaders';
import type { CopyTarget } from '@/server/copy/targets';
import { chainName, usd, walletName } from '@/lib/viz/format';

const col = (s: number) => (s >= 65 ? 'var(--mint)' : s >= 50 ? 'var(--amber)' : 'var(--flare)');
const MARKET: Record<CopyTarget['market'], string> = { spot: 'Spot', perps: 'Perps', predict: 'Predictions' };
const TABS = [['all', 'All'], ['spot', 'Spot'], ['perps', 'Perps'], ['predict', 'Predictions'], ['cohorts', 'KOLs']] as const;

/** Phones: Copy Lab as a list. The best traders to follow in the chosen market, then what the spot leaders just bought. */
export function MobileCopyLab({ targets, spot, tf, market }: { targets: CopyTarget[]; spot: Leaders | null; tf: Timeframe; market: string }) {
  const shown = (market === 'all' || market === 'cohorts' ? targets : targets.filter((t) => t.market === market)).slice(0, 20);
  const fresh = (spot?.buying ?? []).slice(0, 8);
  return (
    <div className="m-screen">
      <LargeTitle title="Copy Lab" caption="Profitable traders worth following" />
      <nav aria-label="Market" className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map(([k, label]) => (
          <Link prefetch={false} key={k} href={k === 'all' ? '/copy' : `/copy?m=${k}`} aria-current={market === k ? 'page' : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-semibold ${market === k ? 'bg-[var(--mint)] text-black' : 'bg-[var(--surface-2)] text-ink-2'}`}>{label}</Link>
        ))}
      </nav>

      <Group title="Worth following" footer="Copy score 0–100, per market.">
        <List>
          {shown.map((t) => (
            <Row key={`${t.market}:${t.address}`} href={`/wallet/${t.address}`} leading={<span className="m-score" style={{ color: col(t.score) }}>{t.score}</span>}
              title={walletName(t.label, t.address)} subtitle={`${MARKET[t.market]} · ${t.record}`}
              trailing={usd(t.pnl, { signed: true })} trailingSub={t.pnlLabel} tone={(t.pnl ?? 0) >= 0 ? 'in' : 'out'} />
          ))}
          {!shown.length && <p className="p-4 text-[14px] text-ink-muted">No leaderboard could be read right now.</p>}
        </List>
      </Group>

      {fresh.length > 0 && (
        <Group title="Spot leaders just bought" footer={`Ranked by their ${tf}-day profit. Check each token's verdict before following.`}>
          <List>
            {fresh.map((r) => (
              <Row key={`${r.leader.address}:${r.chain}:${r.token}`} href={`/token/${r.chain}/${encodeURIComponent(r.token)}`} leading={<TokenLogo symbol={r.symbol} chain={r.chain} address={r.token} size={30} />}
                title={r.symbol ?? r.token.slice(0, 6)} subtitle={<>{walletName(r.leader.label, r.leader.address)} · {chainName(r.chain)}</>}
                trailing={usd(r.usd)} trailingSub={<TimeAgo ts={r.at} />} />
            ))}
          </List>
        </Group>
      )}
    </div>
  );
}
