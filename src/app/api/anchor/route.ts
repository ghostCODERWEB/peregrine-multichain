// GET  /api/anchor?kind=bulletin | kind=token&chain=&address=
//      → the latest report as JSON (never spends credits)
// POST /api/anchor?…same…
//      → SSE: the report streaming in (cached under an hour, else a fresh
//        Nansen agent/fast run within the hourly cap)
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { anchorStream, latestReport, subjectKey, callsThisHour, anchorMaxPerHour, ANCHOR_TTL_MS } from '@/server/agents/anchor';

export const dynamic = 'force-dynamic';

function parse(url: string): { kind: 'bulletin' | 'token'; chain?: string; token?: string } | null {
  const q = new URL(url).searchParams;
  if (q.get('kind') === 'token') {
    const chain = q.get('chain') ?? '', token = q.get('address') ?? '';
    if (!ALL_CHAIN_IDS.includes(chain) || !/^[A-Za-z0-9:._-]{20,160}$/.test(token)) return null;
    return { kind: 'token', chain, token };
  }
  return { kind: 'bulletin' };
}

export async function GET(req: Request) {
  const p = parse(req.url);
  if (!p) return Response.json({ error: 'bad subject' }, { status: 400 });
  const r = latestReport(subjectKey(p.kind, p.chain, p.token));
  return Response.json({
    report: r, fresh: !!r && Date.now() - r.createdAt < ANCHOR_TTL_MS,
    callsLeftThisHour: Math.max(0, anchorMaxPerHour() - callsThisHour()),
  });
}

export async function POST(req: Request) {
  const p = parse(req.url);
  if (!p) return new Response('bad subject', { status: 400 });
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      void (async () => {
        try {
          for await (const e of anchorStream(p.kind, p.chain, p.token)) {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
          }
        } catch (e) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: 'error', message: (e as Error).message.slice(0, 200) })}\n\n`));
        } finally {
          controller.close();
        }
      })();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}
