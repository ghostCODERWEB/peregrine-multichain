// GET /api/rug/[chain]/[address] → SSE. The Rug Checker's data: only the
// waves its checks read (header, holders, cohort flows, then insider
// forensics), not the whole token terminal, so a check spends a fraction of
// a token page's credits. Events: token (name, symbol, logo), report (a
// first reading, then the final one with insider clusters), done (calls).
import { RUG_CHAINS, rugReport } from '@/lib/rug';
import { headerWave, windWave, holdersWave, forensicsWave, isUnavailable, type ForensicsWave, type Wave } from '@/server/token/waves';
import { computeStorm, saveStorm } from '@/server/token/storm';
import { callScope, type CallTally } from '@/server/nansen/client';
import { contextFromRequest, contextScope } from '@/server/context';
import { forMode } from '@/server/redact';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;
  const token = decodeURIComponent(address).trim();
  if (!RUG_CHAINS.includes(chain)) return new Response('Rug checks are not available on this network.', { status: 404 });
  if (!/^[A-Za-z0-9:._-]{20,160}$/.test(token)) return new Response('Not a token address.', { status: 400 });
  const ctx = contextFromRequest(req);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
      let open = true;
      req.signal.addEventListener('abort', () => {
        open = false;
      });
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(forMode(ctx.mode, data))}\n\n`));
        } catch {
          open = false;
        }
      };
      const run = async () => {
        try {
          const [header, wind, holders] = await Promise.all([headerWave(chain, token), windWave(chain, token), holdersWave(chain, token)]);
          const h = isUnavailable(header) ? null : header;
          send(
            'token',
            isUnavailable(header)
              ? { unavailable: header.unavailable }
              : {
                  name: header.name,
                  symbol: header.symbol,
                  logo: header.logo,
                  marketCapUsd: header.marketCapUsd,
                  liquidityUsd: header.liquidityUsd,
                  holders: header.holders,
                },
          );
          send(
            'report',
            rugReport({ header, holders, forensics: undefined, storm: computeStorm(header, wind, holders, undefined, false) }),
          );
          const forensics: Wave<ForensicsWave> = isUnavailable(holders)
            ? { unavailable: 'Insider clusters need the holder list, which Nansen did not return.' }
            : await forensicsWave(chain, token, holders.holders);
          const storm = computeStorm(header, wind, holders, forensics, true);
          if (!isUnavailable(storm) && h) {
            try {
              saveStorm(chain, token, h.symbol, storm, h.marketCapUsd, null, 'page');
            } catch {
              /* the score still shows */
            }
          }
          send('report', rugReport({ header, holders, forensics, storm }));
        } catch (e) {
          send('error', { message: (e as Error).message.slice(0, 300) });
        } finally {
          send('done', tally);
          open = false;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };
      contextScope.run(ctx, () =>
        callScope.run(tally, () => {
          void run();
        }),
      );
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
  });
}
