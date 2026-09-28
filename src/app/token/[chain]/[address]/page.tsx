import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TokenView } from '@/components/token/TokenView';
import { QuickRead } from '@/components/token/QuickRead';
import { TokenTimeMachine } from '@/components/history/PointInTime';
import { getDb } from '@/server/nansen/db';
import type { SmEvent } from '@/components/token/CandleChart';
import { ALL_CHAIN_IDS, chainCapability } from '@/lib/registry';
import { plausibleTokenAddress } from '@/lib/address-family';
import { chainName, shortAddress } from '@/lib/viz/format';
import { displayMode } from '@/server/mode';
import { pageMeta } from '@/server/seo';
import { tokenSymbol } from '@/server/og-data';

type Params = { params: Promise<{ chain: string; address: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { chain, address } = await params;
  const token = decodeURIComponent(address);
  const name = tokenSymbol(chain, token) ?? shortAddress(token);
  return pageMeta({ title: `${name} on ${chainName(chain)}: Token Score and smart money`, description: `${name} on ${chainName(chain)}: a 0–100 dump-risk score, price, smart-money flow, holders and liquidity, from Nansen data.`, path: `/token/${chain}/${encodeURIComponent(token)}` });
}

// The page is a shell; every module streams in from
// /api/token/[chain]/[address]/stream so the header shows while the
// forensics (50+ profiler calls) are still running.
export const dynamic = 'force-dynamic';

export default async function TokenRoute({ params }: Params) {
  const { chain, address } = await params;
  const token = decodeURIComponent(address);
  if (!ALL_CHAIN_IDS.includes(chain) || !plausibleTokenAddress(chain, token)) notFound();
  const mode = await displayMode();
  // Owner view: Smart Money DEX trades in this token over 14 days, for the price chart.
  const smEvents: SmEvent[] = mode === 'owner' ? (getDb().prepare(`SELECT traded_at AS t, side, usd_value AS usd, wallet, wallet_label AS label FROM smart_money_trades WHERE chain = ? AND lower(token_address) = lower(?) AND traded_at >= ? AND usd_value >= 1000 ORDER BY usd_value DESC LIMIT 150`).all(chain, token, Date.now() - 14 * 86_400_000) as SmEvent[]) : [];
  return <TokenView chain={chain} address={decodeURIComponent(address)} tier={chainCapability(chain)!.tier} mode={mode} quickRead={<QuickRead chain={chain} address={token} mode={mode} />} smEvents={smEvents} extra={['base', 'bnb', 'ethereum', 'solana'].includes(chain) ? <TokenTimeMachine chain={chain} address={token} owner={mode === 'owner'} /> : null} />;
}
