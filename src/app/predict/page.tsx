import type { Metadata } from 'next';
import { requestContext, contextScope } from '@/server/context';
import { predictBoard, predictTitle } from '@/server/predict/board';
import { PredictView } from '@/components/predict/PredictView';

export const metadata: Metadata = { title: 'Prediction markets — TIDE' };
export const dynamic = 'force-dynamic';

export default async function PredictPage() {
  // Three cached calls (categories, markets, events): attribution-class data.
  const ctx = await requestContext();
  const board = await contextScope.run(ctx, () => predictBoard());
  return <PredictView board={board} title={predictTitle(board)} />;
}
