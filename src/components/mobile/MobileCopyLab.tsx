import Link from 'next/link';
import { LargeTitle, Group, List, Row } from '@/components/mobile/kit';
import { TokenLogo } from '@/components/Logo';
import { TimeAgo } from '@/components/TimeAgo';
import type { CopyLab } from '@/server/copy/followability';
import { chainName, usd, walletName } from '@/lib/viz/format';

const LAG = ['Same moment', '15 min late', '1 hour late', '6 hours late'];
const p = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;
const col = (s: number) => (s >= 65 ? 'var(--mint)' : s >= 50 ? 'var(--amber)' : 'var(--flare)');

/** Phones: Copy Lab as a story. The finding first, then the decay, then who to follow and what they just bought. */
export function MobileCopyLab({ lab }: { lab: CopyLab }) {
  const d = lab.decay;
  const follow = lab.wallets.filter((w) => w.score >= 60).slice(0, 10);
  const fresh = lab.wallets.filter((w) => w.score >= 65).flatMap((w) => w.recent.map((r) => ({ ...r, w }))).sort((a, b) => b.at - a.at).slice(0, 8);
  const maxAbs = Math.max(0.001, ...d.mean.map(Math.abs));
  return (
    <div className="m-screen">
      <LargeTitle title="Copy Lab" caption="Can you copy Smart Money?" />

      <div className="m-hero">
        <span className="m-hero-label">The median Smart Money buy, 24h later</span>
        <span className="num m-hero-value" style={{ color: d.median[0] >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{p(d.median[0])}</span>
        <span className="m-hero-sub">Only {Math.round(d.win[0] * 100)}% of {lab.buysMeasured.toLocaleString('en-US')} buys were up a day later. A few runners carry the average ({p(d.mean[0])}).</span>
      </div>

      <Group title="If you see the trade late" footer="Average 24h return of copying every buy, priced with Nansen 15-minute candles.">
        <div className="m-list p-4">
          {d.mean.map((x, i) => (
            <div key={i} className={i ? 'mt-3' : ''}>
              <div className="flex items-baseline justify-between text-[14px]"><span className="font-semibold text-ink">{LAG[i]}</span><span className="num font-bold" style={{ color: x >= 0 ? 'var(--mint)' : 'var(--flare)' }}>{p(x)}</span></div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--hair)]"><span className="block h-full rounded-full" style={{ width: `${(Math.abs(x) / maxAbs) * 100}%`, background: x >= 0 ? 'var(--mint)' : 'var(--flare)', opacity: 1 - i * 0.18 }} /></div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Worth copying" footer="Followability: win rate and median return when you enter an hour late. At least three tokens per wallet.">
        <List>
          {follow.map((w) => (
            <Row key={w.wallet} href={`/wallet/${w.wallet}`} leading={<span className="m-score" style={{ color: col(w.score) }}>{w.score}</span>}
              title={walletName(w.label, w.wallet)} subtitle={`${w.tokens} tokens · win ${Math.round(w.win[2] * 100)}% an hour late`}
              trailing={p(w.median[2])} trailingSub="1h late" tone={w.median[2] >= 0 ? 'in' : 'out'} />
          ))}
        </List>
      </Group>

      {fresh.length > 0 && (
        <Group title="They just bought" footer="Check each token's verdict before following.">
          <List>
            {fresh.map((r) => (
              <Row key={`${r.w.wallet}:${r.token}`} href={`/token/${r.chain}/${encodeURIComponent(r.token)}`} leading={<TokenLogo symbol={r.symbol} chain={r.chain} address={r.token} size={30} />}
                title={r.symbol ?? r.token.slice(0, 6)} subtitle={<>{walletName(r.w.label, r.w.wallet)} · {chainName(r.chain)}</>}
                trailing={usd(r.usd)} trailingSub={<TimeAgo ts={r.at} />} />
            ))}
          </List>
        </Group>
      )}

      <Group>
        <Link href="/proof" className="m-proof">Method and limits: past followability is evidence, not a promise</Link>
      </Group>
    </div>
  );
}
