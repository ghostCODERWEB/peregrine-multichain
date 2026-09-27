import { LargeTitle, Group, List, Row } from '@/components/mobile/kit';
import { WalletJump } from '@/components/wallet/WalletJump';
import { TokenLogo } from '@/components/Logo';
import { cachedCopyLab } from '@/server/copy/followability';
import { usd, walletName } from '@/lib/viz/format';

type Active = { wallet: string; label: string | null; trades: number; net: number; top: string | null };
type Perp = { symbol: string; address: string; label: string | null; side: string; value: number };

/** Phones: find a wallet (address or ENS), then the wallets worth watching today. */
export function MobileWallets({ buyers, sellers, perp, owner }: { buyers: Active[]; sellers: Active[]; perp: Perp[]; owner: boolean }) {
  const follow = owner ? cachedCopyLab()?.wallets.filter((w) => w.score >= 60).slice(0, 60) ?? [] : [];
  const topSym = (t: string | null) => (t ?? '').split('|')[0] || null;
  const logo = (t: string | null) => { const [sym, chain, address] = (t ?? '').split('|'); return <TokenLogo symbol={sym || null} chain={chain || undefined} address={address || undefined} size={30} />; };
  return (
    <div className="m-screen">
      <LargeTitle title="Wallets" caption="Profiler · any address or ENS name" />
      <div className="m-search-wrap"><WalletJump /></div>

      {follow.length > 0 && (
        <Group title="Worth copying" href="/copy">
          <List page>
            {follow.map((w) => (
              <Row key={w.wallet} href={`/wallet/${w.wallet}`} leading={<span className="m-score" style={{ color: w.score >= 65 ? 'var(--mint)' : 'var(--amber)' }}>{w.score}</span>}
                title={walletName(w.label, w.wallet)} subtitle={`${w.tokens} tokens · win ${Math.round(w.win[2] * 100)}% an hour late`} trailing={`${w.median[2] >= 0 ? '+' : ''}${(w.median[2] * 100).toFixed(0)}%`} trailingSub="1h late" tone={w.median[2] >= 0 ? 'in' : 'out'} />
            ))}
          </List>
        </Group>
      )}

      {buyers.length > 0 && (
        <Group title="Buying most today" footer="Smart Money net buys on DEXs, 24h.">
          <List page>
            {buyers.map((a) => (
              <Row key={a.wallet} href={`/wallet/${a.wallet}`} leading={logo(a.top)}
                title={walletName(a.label, a.wallet)} subtitle={`${a.trades} trades${topSym(a.top) ? ` · mostly ${topSym(a.top)}` : ''}`} trailing={usd(a.net, { signed: true })} tone="in" />
            ))}
          </List>
        </Group>
      )}

      {sellers.length > 0 && (
        <Group title="Selling most today">
          <List page>
            {sellers.map((a) => (
              <Row key={a.wallet} href={`/wallet/${a.wallet}`} leading={logo(a.top)}
                title={walletName(a.label, a.wallet)} subtitle={`${a.trades} trades${topSym(a.top) ? ` · mostly ${topSym(a.top)}` : ''}`} trailing={usd(a.net, { signed: true })} tone="out" />
            ))}
          </List>
        </Group>
      )}

      {perp.length > 0 && (
        <Group title="Largest perp positions" footer="Smart Money on Hyperliquid, latest snapshot.">
          <List page>
            {perp.map((p) => (
              <Row key={`${p.symbol}:${p.address}`} href={`/wallet/${p.address}`} leading={<TokenLogo symbol={p.symbol} coin={p.symbol} size={30} />}
                title={walletName(p.label, p.address)} subtitle={<span style={{ color: p.side === 'Long' ? 'var(--mint)' : 'var(--flare)' }}>{p.side} {p.symbol}</span>} trailing={usd(p.value)} />
            ))}
          </List>
        </Group>
      )}
    </div>
  );
}
