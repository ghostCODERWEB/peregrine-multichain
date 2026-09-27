// GET /api/ride?chain=&address=&usd=100 — eligibility, and a quote if the
// token qualifies. Never returns a signable transaction.
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { rideQuote, rideEligibility } from '@/server/agents/ride';
import { modeFromRequest, viewOf } from '@/server/mode';
import { allow, clientId } from '@/server/rate';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const chain = q.get('chain') ?? '', address = q.get('address') ?? '';
  if (!ALL_CHAIN_IDS.includes(chain) || !/^[A-Za-z0-9:._-]{20,160}$/.test(address)) return Response.json({ error: 'bad token' }, { status: 400 });
  const mode = viewOf(modeFromRequest(req));
  if (q.get('quote') !== '1') return Response.json({ eligibility: rideEligibility(chain, address, mode) });
  const usd = Number(q.get('usd') ?? 100);
  if (!Number.isFinite(usd) || usd < 1 || usd > 1_000_000) return Response.json({ error: 'Amount must be between $1 and $1,000,000.' }, { status: 400 });
  if (!allow('ride-quote', clientId(req), 10)) return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 });
  try {
    return Response.json(await rideQuote(chain, address, usd, mode));
  } catch (e) {
    return Response.json({ error: `Nansen quote failed: ${(e as Error).message.slice(0, 160)}` }, { status: 502 });
  }
}
