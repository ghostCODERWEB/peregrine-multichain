// Streams the token page in waves over SSE (spec 7): header, then market,
// wind and holders as each lands, a provisional Storm Score, then the
// insider forensics and the final score. Each event is one wave's JSON;
// a wave Nansen can't serve arrives as { unavailable }.
import { ALL_CHAIN_IDS, chainCapability } from '@/lib/registry';
import { headerWave, marketWave, windWave, holdersWave, forensicsWave, isUnavailable, type Wave, type ForensicsWave } from '@/server/token/waves';
import { computeStorm, saveStorm, stormCandidates } from '@/server/token/storm';
import { tapeWave, riverWave, socialWave, dcaWave, positionsWave, pnlBoardWave, leverageWave } from '@/server/token/terminal';
import { forecastWave } from '@/server/token/forecast';
import { callScope, type CallTally } from '@/server/nansen/client';
import { contextFromRequest, contextScope } from '@/server/context';
import { forMode } from '@/server/redact';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;
  if (!ALL_CHAIN_IDS.includes(chain)) return new Response('Unknown chain', { status: 404 });
  const token = decodeURIComponent(address).trim();
  const smChain = !!chainCapability(chain)?.smartMoney;
  const enc = new TextEncoder();
  // The stream outlives this handler: carry the caller's context (mode and
  // whose key) explicitly into every call it makes.
  const ctx = contextFromRequest(req);
  const mode = ctx.mode;

  const stream = new ReadableStream({
    start(controller) {
      // Not returned: the waves stream out as they land instead of the
      // stream waiting on the whole run. The tally follows every call the
      // run makes through AsyncLocalStorage.
      const tally: CallTally = { calls: 0, credits: 0, cached: 0 };
      contextScope.run(ctx, () => callScope.run(tally, () => { void run(controller, tally); }));
    },
  });

  async function run(controller: ReadableStreamDefaultController<Uint8Array>, tally: CallTally) {
      let open = true;
      req.signal.addEventListener('abort', () => { open = false; });
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try { controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(forMode(mode, data))}\n\n`)); } catch { open = false; }
      };
      try {
        const header = headerWave(chain, token).then((w) => { send('header', w); return w; });
        const market = marketWave(chain, token, smChain).then((w) => { send('market', w); return w; });
        const forecast = market.then((m) => forecastWave(chain, token, isUnavailable(m) ? null : m.candles)).then((w) => { send('forecast', w); return w; });
        const wind = windWave(chain, token).then((w) => { send('wind', w); return w; });
        const holders = holdersWave(chain, token).then((w) => { send('holders', w); return w; });

        // The terminal (M2). Label-derived views — the position gauge, the
        // PnL leaderboard and cohort-based transfer anomalies — only for the
        // key owner or a member; public views get the rest, labels stripped.
        const priv = mode !== 'public';
        const tape = tapeWave(chain, token).then((w) => { send('tape', w); return w; });
        const river = riverWave(chain, token, priv).then((w) => { send('river', w); return w; });
        const terminal = header.then(async (hw) => {
          const symbol = isUnavailable(hw) ? null : hw.symbol;
          const volume = isUnavailable(hw) ? null : hw.volume24hUsd;
          const [social, dca] = await Promise.all([
            socialWave(symbol).then((w) => { send('social', w); return w; }),
            dcaWave(chain, token, volume).then((w) => { send('dca', w); return w; }),
            leverageWave(symbol).then((w) => { send('leverage', w); return w; }),
            priv ? positionsWave(symbol).then((w) => { send('positions', w); return w; }) : Promise.resolve(null),
            priv ? pnlBoardWave(chain, token).then((w) => { send('pnlboard', w); return w; }) : Promise.resolve(null),
          ]);
          send('candidates', stormCandidates(social, dca));
        });

        const [h, w, ho] = await Promise.all([header, wind, holders]);
        send('storm', computeStorm(h, w, ho, undefined, false));

        const forensics: Wave<ForensicsWave> = isUnavailable(ho)
          ? { unavailable: 'Insider clusters need the holder list, which Nansen did not return.' }
          : await forensicsWave(chain, token, ho.holders);
        send('forensics', forensics);

        const m = await market;
        await Promise.all([forecast, tape, river, terminal]);
        const storm = computeStorm(h, w, ho, forensics, true);
        send('storm', storm);
        if (!isUnavailable(storm) && !isUnavailable(h)) {
          saveStorm(chain, token, h.symbol, storm, h.marketCapUsd, isUnavailable(m) ? null : m.candles.at(-1)?.c ?? null, 'page');
        }

        // Exactly what this page cost: every Nansen call made inside this
        // request's scope, cached or live.
        send('done', { ...tally });
      } catch (e) {
        send('fatal', { message: (e as Error).message.slice(0, 200) });
      } finally {
        if (open) controller.close();
      }
  }

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' },
  });
}
