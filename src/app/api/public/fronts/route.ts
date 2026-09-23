// GET /api/public/fronts?hours=24 — rotation fronts: net capital moving
// between chains, measured from the same wallets selling on one chain and
// buying on another. From TIDE's scanner record: no credits per request.
import { rotationFronts } from '@/server/weather/queries';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const hours = Math.min(168, Math.max(1, Number(new URL(req.url).searchParams.get('hours') ?? 24)));
  const fronts = rotationFronts(hours).map((f) => ({
    from: f.from, to: f.to, net_usd: f.netUsd, wallets: f.walletCount, confidence: f.confidence, inferred: f.inferred,
  }));
  return Response.json({ hours, fronts }, { headers: { 'Access-Control-Allow-Origin': '*' } });
}
