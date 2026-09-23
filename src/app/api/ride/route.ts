// GET /api/ride?chain=&address=&usd=100 — eligibility, and a quote if the
// token qualifies. Never returns a signable transaction.
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { rideQuote, rideEligibility } from '@/server/agents/ride';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain') ?? '', address = q.get('address') ?? '';
  if (!ALL_CHAIN_IDS.includes(chain) || !/^[A-Za-z0-9:._-]{20,160}$/.test(address)) return Response.json({ error: 'bad token' }, { status: 400 });
  if (q.get('quote') !== '1') return Response.json({ eligibility: rideEligibility(chain, address) });
  try {
    return Response.json(await rideQuote(chain, address, Number(q.get('usd') ?? 100)));
  } catch (e) {
    return Response.json({ error: `Nansen quote failed: ${(e as Error).message.slice(0, 160)}` }, { status: 502 });
  }
}
