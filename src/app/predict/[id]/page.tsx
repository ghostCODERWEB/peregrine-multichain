import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MARKET_ID_RE, marketDetail, predictBoard } from '@/server/predict/board';
import { contextScope, requestContext } from '@/server/context';
import { displayMode } from '@/server/mode';
import { forMode } from '@/server/redact';
import { outcomeBoard } from '@/lib/models/outcomes';
import { PredictMarketView } from '@/components/predict/PredictMarketView';
import { MarketAnalyticsView } from '@/components/predict/MarketAnalyticsView';
import { marketAnalytics } from '@/server/predict/market';
import { pageMeta } from '@/server/seo';
import { storedBoard } from '@/server/predict/board';

export const dynamic = 'force-dynamic';
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = decodeURIComponent((await params).id);
  const m = storedBoard()?.markets.find((x) => x.id === id);
  const prob = m?.price != null ? ` Priced at ${Math.round(m.price * 100)}% YES.` : '';
  return pageMeta({
    title: m?.question ? m.question.slice(0, 90) : 'Prediction market',
    description: `${m?.question ? `${m.question}${prob} ` : ''}Implied probability, repricing, order book and the traders on each side, from Polymarket via Nansen.`,
    path: `/predict/${encodeURIComponent(id)}`,
  });
}

/** One Polymarket market (via Nansen), URL-addressable: pulse and written brief, statistics, flow, top traders, outcomes, price and volume, depth, holders, positions, trades, related markets. */
export default async function PredictMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  if (!MARKET_ID_RE.test(id)) notFound();
  const mode = await displayMode();
  const ctx = await requestContext();
  const [board, detail] = await contextScope.run(ctx, () => Promise.all([predictBoard(), marketDetail(id)]));
  const market = board.markets.find((m) => m.id === id) ?? null;
  // Not on the board and Nansen answered every read with nothing: no such market. (If a read failed, the
  // page still renders and says which.)
  if (!market && !detail.errors.length && !detail.candles.length && !detail.book && !detail.holders.length && !detail.trades.length) notFound();
  // Price statistics, flow, book balance, holder concentration, top traders and related markets.
  const analytics = await contextScope.run(ctx, () => marketAnalytics(id, detail, board));
  const siblings = market?.eventTitle ? board.markets.filter((m) => m.eventTitle === market.eventTitle) : market ? [market] : [];
  return <PredictMarketView market={market} detail={forMode(mode, detail)} outcomes={outcomeBoard(siblings)} owner={mode === 'owner'} analytics={<MarketAnalyticsView id={id} a={forMode(mode, analytics)} mode={mode} />} />;
}
