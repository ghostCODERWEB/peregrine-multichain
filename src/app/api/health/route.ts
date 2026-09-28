// GET /api/health → 200 when the server can answer and read its database; 503 otherwise.
// For the platform's deploy and uptime checks: no Nansen call, no page render.
import { getDb } from '@/server/nansen/db';

export const dynamic = 'force-dynamic';

export function GET() {
  try {
    getDb().prepare('SELECT 1').get();
    return Response.json({ ok: true, uptimeSeconds: Math.round(process.uptime()) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message.slice(0, 200) }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
