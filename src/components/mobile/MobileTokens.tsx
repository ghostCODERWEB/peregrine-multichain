import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { LargeTitle, Group, List, Row, Rail } from '@/components/mobile/kit';
import { RugSearch } from '@/components/rug/RugSearch';
import { TokenLogo } from '@/components/Logo';
import { RUG_CHAINS } from '@/lib/rug';
import type { CheckerData } from '@/server/token/checker';
import { chainName, pct, usd } from '@/lib/viz/format';

const level = (s: number) => (s >= 55 ? { word: 'Danger', color: 'var(--flare)' } : s >= 35 ? { word: 'Watch', color: 'var(--amber)' } : { word: 'Low', color: 'var(--mint)' });
const badge = (s: number) => { const l = level(s); return <span className="m-badge" style={{ color: l.color, background: `color-mix(in srgb, ${l.color} 14%, transparent)` }}>{Math.round(s)} · {l.word}</span>; };
const href = (t: { chain: string; address: string }) => `/token/${t.chain}/${encodeURIComponent(t.address)}`;

/** Phones: token risk at a glance. Search first, then who is buying risk, then scores and what is trading. */
export function MobileTokens({ d }: { d: CheckerData }) {
  const risky = d.smIntoRisk.slice(0, 8);
  return (
    <div className="m-screen">
      <LargeTitle title="Tokens" caption={`${RUG_CHAINS.length} networks · Token Score`} />
      <div className="m-search-wrap"><RugSearch chains={RUG_CHAINS} autoFocus={false} placeholder="Name, symbol or address" /></div>

      {risky.length > 0 && (
        <Group title="Smart Money buying risk" footer="Net Smart Money buys in 24h into tokens scoring 50 or more.">
          <Rail label="Smart Money buying risk">
            {risky.map((r) => {
              const l = level(r.score);
              return (
                <Link prefetch={false} role="listitem" key={`${r.chain}:${r.address}`} href={href(r)} className="m-card m-risk">
                  <span className="flex items-center justify-between"><TokenLogo symbol={r.symbol} chain={r.chain} address={r.address} size={34} /><span className="m-badge" style={{ color: l.color, background: `color-mix(in srgb, ${l.color} 14%, transparent)` }}><ShieldAlert size={12} />{Math.round(r.score)}</span></span>
                  <span className="m-card-title">{r.symbol}</span>
                  <span className="m-row-sub">{chainName(r.chain)}</span>
                  <span className="m-card-foot"><b style={{ color: 'var(--mint)' }}>+{usd(r.net)}</b> · {r.buyers} wallet{r.buyers === 1 ? '' : 's'}</span>
                </Link>
              );
            })}
          </Rail>
        </Group>
      )}

      {d.scored.length > 0 && (
        <Group title="Token Scores" footer="50% Nansen risk indicators, 50% Peregrine's model. Tap a token for its verdict.">
          <List>
            {d.scored.slice(0, 12).map((s) => (
              <Row key={`${s.chain}:${s.address}`} href={href(s)} leading={<TokenLogo symbol={s.symbol} chain={s.chain} address={s.address} size={30} />}
                title={s.symbol} subtitle={`${chainName(s.chain)} · Nansen ${s.nansen != null ? Math.round(s.nansen) : 'n/a'} · Peregrine ${s.peregrine != null ? Math.round(s.peregrine) : 'n/a'}`} trailing={badge(s.score)} />
            ))}
          </List>
        </Group>
      )}

      {d.universe.length > 0 && (
        <Group title="Trading now" footer="All traders, 24h volume.">
          <List>
            {d.universe.slice(0, 10).map((u) => (
              <Row key={`${u.chain}:${u.address}`} href={href(u)} leading={<TokenLogo symbol={u.symbol} chain={u.chain} address={u.address} size={30} />}
                title={u.symbol ?? u.address.slice(0, 6)} subtitle={`${chainName(u.chain)} · vol ${usd(u.volume)}`}
                trailing={u.change != null ? `${u.change > 0 ? '+' : ''}${pct(u.change, 1)}` : 'n/a'} tone={(u.change ?? 0) >= 0 ? 'in' : 'out'} trailingSub={u.score != null ? `score ${Math.round(u.score)}` : undefined} />
            ))}
          </List>
        </Group>
      )}

      {d.fresh.length > 0 && (
        <Group title="New launches" footer="Seven days old or younger. New tokens carry the most risk: check the verdict first.">
          <List>
            {d.fresh.slice(0, 8).map((u) => (
              <Row key={`${u.chain}:${u.address}`} href={href(u)} leading={<TokenLogo symbol={u.symbol} chain={u.chain} address={u.address} size={30} />}
                title={u.symbol ?? u.address.slice(0, 6)} subtitle={`${chainName(u.chain)} · ${u.ageDays != null ? `${Math.round(u.ageDays)}d old` : 'new'} · liq ${usd(u.liquidity)}`}
                trailing={u.change != null ? `${u.change > 0 ? '+' : ''}${pct(u.change, 0)}` : 'n/a'} tone={(u.change ?? 0) >= 0 ? 'in' : 'out'} />
            ))}
          </List>
        </Group>
      )}
    </div>
  );
}
