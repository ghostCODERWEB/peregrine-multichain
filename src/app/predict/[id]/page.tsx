import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { MARKET_ID_RE, marketDetail, predictBoard } from '@/server/predict/board';
import { contextScope, requestContext } from '@/server/context';
import { displayMode } from '@/server/mode';
import { forMode } from '@/server/redact';
import { outcomeBoard } from '@/lib/models/outcomes';
import { PredictMarketView } from '@/components/predict/PredictMarketView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Prediction market · Peregrine' };

/** One Polymarket market (via Nansen), URL-addressable: outcomes, price, book, holders, trades. */
export default async function PredictMarketPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  if (!MARKET_ID_RE.test(id)) notFound();
  const mode = await displayMode();
  const ctx = await requestContext();
  const [board, detail] = await contextScope.run(ctx, () => Promise.all([predictBoard(), marketDetail(id)]));
  const market = board.markets.find((m) => m.id === id) ?? null;
  const siblings = market?.eventTitle ? board.markets.filter((m) => m.eventTitle === market.eventTitle) : market ? [market] : [];
  return <PredictMarketView market={market} detail={forMode(mode, detail)} outcomes={outcomeBoard(siblings)} owner={mode === 'owner'} />;
}
