import type { Metadata } from 'next';
import { requestContext, contextScope } from '@/server/context';
import { predictBoard, predictTitle } from '@/server/predict/board';
import { PredictView } from '@/components/predict/PredictView';
import { PredictAnalytics } from '@/components/predict/PredictAnalytics';
import { predictOverview } from '@/server/predict/overview';
import { pageMeta } from '@/server/seo';

export const metadata: Metadata = pageMeta({ title: 'Prediction markets: Polymarket flows by category', description: 'Polymarket via Nansen: each category\'s activity against its weekly pace, the biggest repricings, the busiest events and the traders behind them.', path: '/predict' });
export const dynamic = 'force-dynamic';

export default async function PredictPage() {
  // Three cached calls (categories, markets, events): attribution-class data.
  const ctx = await requestContext();
  const board = await contextScope.run(ctx, () => predictBoard());
  // Trending and moving markets' 7-day history and the latest trades: about 20 cached calls, shared with market pages.
  const o = await contextScope.run(ctx, () => predictOverview(board));
  const series = Object.fromEntries(Object.entries(o.series).map(([id, x]) => [id, x.prob.map((p) => p * 100)]));
  return <PredictView board={board} title={predictTitle(board)} series={series} analytics={board.unavailable ? null : <PredictAnalytics board={board} o={o} mode={ctx.mode} />} />;
}
