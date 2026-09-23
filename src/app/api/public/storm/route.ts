// GET /api/public/storm?chain=base&token=0x… — the latest Storm Score TIDE
// computed for a token (from a page view or the scanner's sweep). Never
// triggers new Nansen calls; without ?token, the current storm warnings.
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { getDb } from '@/server/nansen/db';
import { stormTicker } from '@/server/weather/queries';

export const dynamic = 'force-dynamic';
const cors = { 'Access-Control-Allow-Origin': '*' };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain'), token = q.get('token');
  if (!token) return Response.json({ storms: stormTicker(20) }, { headers: cors });
  if (!chain || !ALL_CHAIN_IDS.includes(chain)) return Response.json({ error: 'Pass a known ?chain= with ?token=' }, { status: 400, headers: cors });
  const r = getDb().prepare(`
    SELECT symbol, score, band, confidence, sub_scores, missing, market_cap_usd, source, computed_at
    FROM storm_scores WHERE chain = ? AND token_address = ? ORDER BY id DESC LIMIT 1
  `).get(chain, token.toLowerCase()) as { symbol: string | null; score: number; band: string; confidence: number; sub_scores: string; missing: string; market_cap_usd: number | null; source: string; computed_at: number } | undefined;
  if (!r) return Response.json({ error: 'TIDE has not scored this token yet. Open /token/{chain}/{token} once to compute it.' }, { status: 404, headers: cors });
  return Response.json({
    chain, token, symbol: r.symbol, storm_score: r.score, band: r.band, confidence: r.confidence,
    sub_scores: JSON.parse(r.sub_scores), missing_inputs: JSON.parse(r.missing), market_cap_usd: r.market_cap_usd,
    computed_at: r.computed_at, computed_by: r.source, page: `/token/${chain}/${token}`,
    note: 'Probabilistic dump-risk score, 0-100. Not financial advice.',
  }, { headers: cors });
}
