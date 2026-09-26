// TIDE's MCP tools: the signals TIDE derives from Nansen (pressure, storms,
// alpha, perp pressure, prediction weather, sectors, fronts, smart-money
// conviction), for any MCP client. Each tool runs in the caller's context:
// public callers get public-class data with labels stripped, the key owner
// and members get their private views. Most tools read TIDE's own history
// and cost nothing; the ones that call Nansen say so in their description.
import { z } from 'zod';
import type { RequestContext } from '@/server/context';
import { viewOf } from '@/server/mode';
import { forMode } from '@/server/redact';
import { buildBulletin } from '@/server/weather/bulletin';
import { mapHeadline } from '@/lib/insights';
import { chainWeather, pressureForecast, rotationFronts } from '@/server/weather/queries';
import { alphaBoard } from '@/server/alpha/board';
import { perpBoard } from '@/server/perps/board';
import { predictBoard } from '@/server/predict/board';
import { sectorWeather } from '@/server/sectors/weather';
import { smDesk, parseChain } from '@/server/smart-money/desk';
import { omnibox } from '@/server/search/omnibox';
import { getDb } from '@/server/nansen/db';
import { ALL_CHAIN_IDS } from '@/lib/registry';

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  private?: boolean;
  run: (ctx: RequestContext, args: Record<string, unknown>) => Promise<unknown> | unknown;
}

const chainArg = { type: 'string', description: 'Chain id as Nansen names it, e.g. "base", "solana", "ethereum".' };
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};
const needChain = (v: unknown) => {
  const c = str(v, 30);
  if (!ALL_CHAIN_IDS.includes(c)) throw new Error(`Unknown chain "${c}". Try tide_weather for the list.`);
  return c;
};

export const TOOLS: ToolDef[] = [
  {
    name: 'tide_weather',
    description:
      "Cross-chain flows: Flow Index (0-100) for every chain Nansen covers, the strongest inflow and outflow, capital rotations (owner only), risk alerts and the headline. Free: reads Peregrine's own scanner history.",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: (ctx) => {
      const b = buildBulletin(viewOf(ctx.mode));
      const tiles = b.chains.map((c) => ({ chain: c.chain, cpi: c.cpi, band: c.band, trend6h: c.trend6h, source: c.source }));
      return {
        headline: mapHeadline(b.chains, b.fronts),
        view: b.mode,
        withheld: b.withheld,
        chains: tiles.filter((c) => c.cpi != null).sort((x, y) => y.cpi! - x.cpi!),
        noReading: tiles.filter((c) => c.cpi == null).map((c) => c.chain),
        storms: b.storms.slice(0, 10),
        fronts: b.fronts.slice(0, 5).map((f) => ({ from: f.from, to: f.to, netUsd: f.netUsd, wallets: f.walletCount })),
        lastScan: b.scan,
      };
    },
  },
  {
    name: 'tide_chain',
    description: "One chain's flow reading, its three windows (1h/24h/7d), the 7-day series and a 24h projection with an 80% band. Free.",
    inputSchema: { type: 'object', properties: { chain: chainArg }, required: ['chain'], additionalProperties: false },
    run: (ctx, a) => {
      const chain = needChain(a.chain),
        view = viewOf(ctx.mode);
      const w = chainWeather(chain, Date.now(), view);
      const f = pressureForecast(chain, 24, Date.now(), view);
      return {
        ...w,
        series: w.series.slice(-48),
        forecast: { insufficient: f.insufficient, end: f.points.at(-1) ?? null, mape: f.mape, sampleSize: f.sampleSize },
      };
    },
  },
  {
    name: 'tide_storm',
    description:
      'The latest Dump Risk score (0-100) Peregrine stored for a token, with its six sub-scores and band. Free; returns nothing if no one has opened the token recently (open /token/{chain}/{address} to compute a fresh one).',
    inputSchema: {
      type: 'object',
      properties: { chain: chainArg, token: { type: 'string', description: 'Token contract address or mint.' } },
      required: ['chain', 'token'],
      additionalProperties: false,
    },
    run: (_ctx, a) => {
      const chain = needChain(a.chain),
        token = str(a.token, 120);
      const r = getDb()
        .prepare(
          'SELECT symbol, score, band, confidence, sub_scores, missing, market_cap_usd, computed_at FROM storm_scores WHERE chain = ? AND lower(token_address) = lower(?) ORDER BY id DESC LIMIT 1',
        )
        .get(chain, token) as
        | {
            symbol: string | null;
            score: number;
            band: string;
            confidence: number;
            sub_scores: string;
            missing: string;
            market_cap_usd: number | null;
            computed_at: number;
          }
        | undefined;
      if (!r) return { found: false, note: 'Peregrine has no Dump Risk for this token yet.' };
      return {
        found: true,
        symbol: r.symbol,
        score: Math.round(r.score),
        band: r.band,
        confidence: r.confidence,
        subScores: JSON.parse(r.sub_scores),
        missing: JSON.parse(r.missing),
        marketCapUsd: r.market_cap_usd,
        computedAt: new Date(r.computed_at).toISOString(),
      };
    },
  },
  {
    name: 'tide_alpha',
    description:
      'Tokens worth a look across every chain the scanner reads, scored 0-100 from named reasons (net buying, persistence, acceleration, smart-money share, liquidity, extended moves, Storm). Free.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { ...chainArg, description: 'Optional: one chain only.' },
        limit: { type: 'number', description: '1-50, default 15.' },
      },
      additionalProperties: false,
    },
    run: (ctx, a) => {
      const b = alphaBoard(viewOf(ctx.mode), Date.now(), 60);
      const chain = str(a.chain, 30);
      return {
        at: b.at,
        rows: b.rows
          .filter((r) => !chain || r.chain === chain)
          .slice(0, num(a.limit, 15, 1, 50))
          .map((r) => ({
            chain: r.chain,
            token: r.tokenAddress,
            symbol: r.symbol,
            score: r.score,
            reasons: r.parts.map((p) => `${p.points > 0 ? '+' : ''}${p.points} ${p.label}: ${p.detail}`),
          })),
      };
    },
  },
  {
    name: 'tide_perps',
    description:
      "Hyperliquid perp flow: the venue's Perp Flow Index (0-100) and each coin's, from taker flow, funding and (owner/members) smart money's long/short book. Free: reads Peregrine's hourly snapshots.",
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Optional coin, e.g. "BTC" or "xyz:SP500".' },
        limit: { type: 'number', description: '1-50, default 15.' },
      },
      additionalProperties: false,
    },
    run: (ctx, a) => {
      const b = perpBoard(viewOf(ctx.mode));
      const sym = str(a.symbol, 32).toUpperCase();
      const coins = b.coins
        .filter((c) => c.ppi != null && (!sym || c.symbol.toUpperCase() === sym))
        .slice(0, num(a.limit, 15, 1, 50))
        .map((c) => ({
          symbol: c.symbol,
          ppi: Math.round(c.ppi!),
          fundingApr: c.fundingApr,
          openInterest: c.openInterest,
          taker: c.taker,
          smSkew: c.sm?.skew ?? null,
          divergence: c.divergence,
        }));
      return { venue: b.venue, at: b.at, coins, unavailable: b.unavailable };
    },
  },
  {
    name: 'tide_predictions',
    description:
      "Prediction-market activity (Polymarket via Nansen): each category's volume against its own weekly pace, and the day's biggest repricings of open questions. Costs up to 3 Nansen credits (cached 10-15 minutes).",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: async () => {
      const b = await predictBoard();
      return {
        totals: b.totals,
        categories: b.categories
          .slice(0, 15)
          .map((c) => ({ category: c.category, heat: c.heat, volume24h: c.volume24h, openInterest: c.openInterest })),
        topMarkets: b.markets
          .slice(0, 15)
          .map((m) => ({ question: m.question, impliedYes: m.price, change1d: m.change1d, volume24h: m.volume24h })),
        unavailable: b.unavailable,
      };
    },
  },
  {
    name: 'tide_sectors',
    description: 'Sector flows: net flow per Nansen token sector, built like the Flow Index. Free.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: (ctx) => sectorWeather(viewOf(ctx.mode)),
  },
  {
    name: 'tide_fronts',
    description:
      "Capital rotations: capital moving from one chain to another, matched from the same wallets' sells and later buys within 12 hours. Key owner only (built from smart-money trades).",
    inputSchema: {
      type: 'object',
      properties: { hours: { type: 'number', description: '6-168, default 24.' } },
      additionalProperties: false,
    },
    private: true,
    run: (ctx, a) => {
      if (ctx.mode !== 'owner') throw new Error("Capital rotations are the instance owner's view only.");
      return rotationFronts(num(a.hours, 24, 6, 168))
        .slice(0, 10)
        .map((f) => ({ from: f.from, to: f.to, netUsd: f.netUsd, wallets: f.walletCount, confidence: f.confidence }));
    },
  },
  {
    name: 'tide_smart_money',
    description:
      'Smart-money conviction: tokens smart money is adding to or trimming, weighted by how many top-PnL wallets hold them, and crowded exits. Owner or members only; costs up to 10 Nansen credits (cached).',
    inputSchema: {
      type: 'object',
      properties: {
        chain: { ...chainArg, description: 'A smart-money chain or "all" (default).' },
        limit: { type: 'number', description: '1-50, default 15.' },
      },
      additionalProperties: false,
    },
    private: true,
    run: async (ctx, a) => {
      if (ctx.mode === 'public') throw new Error('Smart-money holdings are shown to the key owner or a member with their own key only.');
      const d = await smDesk(parseChain(str(a.chain, 30) || 'all'));
      const n = num(a.limit, 15, 1, 50);
      const byConv = [...d.holdings].filter((h) => h.conviction != null).sort((x, y) => y.conviction! - x.conviction!);
      return {
        totals: d.totals,
        adding: byConv
          .slice(0, n)
          .map((h) => ({
            chain: h.chain,
            symbol: h.symbol,
            token: h.tokenAddress,
            conviction: h.conviction,
            change24h: h.change24h,
            wallets: h.holders,
            backers: h.backers,
          })),
        crowdedExits: d.holdings
          .filter((h) => h.crowdedExit)
          .map((h) => ({ chain: h.chain, symbol: h.symbol, change24h: h.change24h, wallets: h.holders })),
      };
    },
  },
  {
    name: 'tide_search',
    description: 'Find tokens, Nansen entities, chains, sectors or wallet addresses by name or address. Free (Nansen search is 0 credits).',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false },
    run: async (_ctx, a) => {
      const q = str(a.query, 120);
      if (q.length < 2) throw new Error('Search for at least two characters.');
      return omnibox(q);
    },
  },
];

export const ToolCall = z.object({ name: z.string(), arguments: z.record(z.string(), z.unknown()).optional() });

/** Runs a tool and returns MCP content; labels are stripped for public callers. */
export async function callTool(ctx: RequestContext, name: string, args: Record<string, unknown>) {
  const t = TOOLS.find((x) => x.name === name);
  if (!t) return { isError: true, content: [{ type: 'text', text: `Unknown tool "${name}".` }] };
  try {
    const out = forMode(ctx.mode, await t.run(ctx, args));
    const body = { source: 'Nansen API, via Peregrine', view: ctx.mode, result: out };
    return { content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: (e as Error).message.slice(0, 300) }] };
  }
}
