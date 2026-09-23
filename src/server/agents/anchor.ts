// The AI Anchor (spec 6.1): Nansen's own agent (agent/fast, 200 credits)
// reads TIDE's computed numbers and writes a four-sentence broadcast. Two
// subjects — the global bulletin and one token — each reused for an hour,
// and a hard ANCHOR_MAX_PER_HOUR across all subjects so a busy page can't
// burn the key's credits. Nothing is generated on page load: only on an
// explicit request.
import { getDb } from '@/server/nansen/db';
import { streamNansen } from '@/server/nansen/client';
import { buildBulletin } from '@/server/weather/bulletin';
import { chainName } from '@/lib/viz/format';

export const ANCHOR_TTL_MS = 60 * 60_000;
export const anchorMaxPerHour = () => Number(process.env.ANCHOR_MAX_PER_HOUR ?? 2);

export interface AnchorReport {
  subject: string;
  text: string;
  toolCalls: string[];
  credits: number;
  createdAt: number;
}

export type AnchorEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'done'; report: AnchorReport; cached: boolean }
  | { type: 'error'; message: string };

export function latestReport(subject: string): AnchorReport | null {
  const r = getDb().prepare('SELECT subject, text, tool_calls, credits, created_at FROM anchor_reports WHERE subject = ? ORDER BY id DESC LIMIT 1')
    .get(subject) as { subject: string; text: string; tool_calls: string; credits: number; created_at: number } | undefined;
  return r ? { subject: r.subject, text: r.text, toolCalls: JSON.parse(r.tool_calls) as string[], credits: r.credits, createdAt: r.created_at } : null;
}

export function callsThisHour(now = Date.now()): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM anchor_reports WHERE created_at >= ? AND credits > 0').get(now - 3_600_000) as { n: number }).n;
}

const RULES = [
  'Use only the numbers in the JSON. Cite at least three of them.',
  'Write exactly four sentences, like a weather broadcast: calm, specific, no hype.',
  'Probabilistic language only ("suggests", "odds", "tends to"). Never tell anyone to buy, sell or hold.',
  'If a field is missing, do not guess it. Plain text, no markdown, no lists.',
].join(' ');

/** CPI 0-100: above 65 net buying (high pressure), below 35 net selling. */
function bulletinPrompt(): { prompt: string; facts: unknown } {
  const b = buildBulletin();
  const chains = b.chains.filter((c) => c.cpi != null)
    .sort((a, c) => Math.abs(c.cpi! - 50) - Math.abs(a.cpi! - 50)).slice(0, 6)
    .map((c) => ({ chain: chainName(c.chain), pressure_index: Math.round(c.cpi!), measured_from: c.source, change_6h: c.trend6h == null ? null : Math.round(c.trend6h) }));
  const fronts = b.fronts.slice(0, 3).map((f) => ({ from: chainName(f.from), to: chainName(f.to), net_usd: Math.round(f.netUsd), wallets: f.walletCount }));
  const storms = b.storms.slice(0, 3).map((s) => ({ token: s.symbol, chain: chainName(s.chain), storm_score: Math.round(s.score), band: s.band, confidence: Number(s.confidence.toFixed(2)) }));
  const forecasts = b.forecasts.filter((f) => f.points.length).slice(0, 3)
    .map((f) => ({ chain: chainName(f.chain), now: Math.round(f.history.at(-1)!.cpi), in_24h: Math.round(f.points.at(-1)!.forecast), mape_pct: f.mape == null ? null : Number(f.mape.toFixed(1)) }));
  const facts = {
    scale: 'Chain Pressure Index 0-100 from smart-money net flow: above 65 = smart money net buying (high pressure), below 35 = net selling, 50 = calm.',
    pressure_extremes: chains, rotation_fronts_24h: fronts, storm_warnings: storms, forecasts_24h: forecasts,
  };
  return {
    facts,
    prompt: `You are the anchor of TIDE, a smart-money weather report built on Nansen data. ${RULES}\nTIDE's current readings:\n${JSON.stringify(facts)}`,
  };
}

function tokenPrompt(chain: string, token: string): { prompt: string; facts: unknown } | null {
  const r = getDb().prepare(`
    SELECT symbol, score, band, confidence, sub_scores, missing, market_cap_usd, computed_at FROM storm_scores
    WHERE chain = ? AND token_address = ? ORDER BY id DESC LIMIT 1
  `).get(chain, token.toLowerCase()) as { symbol: string | null; score: number; band: string; confidence: number; sub_scores: string; missing: string; market_cap_usd: number | null; computed_at: number } | undefined;
  if (!r) return null;
  const sub = JSON.parse(r.sub_scores) as Record<string, number | null>;
  const facts = {
    token: r.symbol, chain: chainName(chain), token_address: token,
    storm_score: Math.round(r.score), band: r.band, confidence: Number(r.confidence.toFixed(2)),
    sub_scores_0_to_100: Object.fromEntries(Object.entries(sub).map(([k, v]) => [k, v == null ? null : Math.round(v)])),
    missing_inputs: JSON.parse(r.missing) as string[],
    market_cap_usd: r.market_cap_usd == null ? null : Math.round(r.market_cap_usd),
    scale: 'Storm Score = 7-day dump risk 0-100: <25 Clear, <50 Cloudy, <75 Storm Watch, else Storm Warning. Sub-scores: concentration of holders, insider clusters, wind shear (informed selling into fresh buying), exit liquidity, sell pressure, Nansen risk indicators.',
  };
  return {
    facts,
    prompt: `You are the anchor of TIDE, a smart-money weather report built on Nansen data. Explain what TIDE's scores say about this token. ${RULES}\nTIDE's scores:\n${JSON.stringify(facts)}`,
  };
}

export function subjectKey(kind: 'bulletin' | 'token', chain?: string, token?: string) {
  return kind === 'bulletin' ? 'bulletin' : `token:${chain}:${token!.toLowerCase()}`;
}

/**
 * Streams a report: the cached one if it's under an hour old (no credits),
 * otherwise a fresh agent/fast run — unless this hour's cap is spent.
 */
export async function* anchorStream(kind: 'bulletin' | 'token', chain?: string, token?: string): AsyncGenerator<AnchorEvent> {
  const subject = subjectKey(kind, chain, token);
  const cached = latestReport(subject);
  if (cached && Date.now() - cached.createdAt < ANCHOR_TTL_MS) {
    for (const name of cached.toolCalls) yield { type: 'tool', name };
    yield { type: 'delta', text: cached.text };
    yield { type: 'done', report: cached, cached: true };
    return;
  }
  const max = anchorMaxPerHour();
  if (callsThisHour() >= max) {
    yield { type: 'error', message: `The anchor has used its ${max} Nansen agent calls for this hour (ANCHOR_MAX_PER_HOUR). ${cached ? 'The last report is shown instead.' : 'Try again later.'}` };
    if (cached) yield { type: 'done', report: cached, cached: true };
    return;
  }
  const built = kind === 'bulletin' ? bulletinPrompt() : tokenPrompt(chain!, token!);
  if (!built) {
    yield { type: 'error', message: 'Open the token page first: the anchor reads the Storm Score TIDE computes there.' };
    return;
  }

  let text = '';
  const tools: string[] = [];
  let conversation: string | null = null;
  try {
    for await (const e of streamNansen('agent/fast', { text: built.prompt })) {
      if (e.type === 'delta') { text += e.text; yield { type: 'delta', text: e.text }; }
      else if (e.type === 'tool_call') { if (!tools.includes(e.name)) { tools.push(e.name); yield { type: 'tool', name: e.name }; } }
      else if (e.type === 'finish') conversation = e.conversation_id;
      else if (e.type === 'error') { yield { type: 'error', message: `Nansen agent: ${e.error}` }; break; }
    }
  } catch (err) {
    yield { type: 'error', message: `Nansen agent call failed: ${(err as Error).message.slice(0, 160)}` };
  }
  if (!text.trim()) return;
  const report: AnchorReport = { subject, text: text.trim(), toolCalls: tools, credits: 200, createdAt: Date.now() };
  getDb().prepare('INSERT INTO anchor_reports (subject, prompt, text, tool_calls, conversation_id, credits, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(subject, built.prompt, report.text, JSON.stringify(tools), conversation, report.credits, report.createdAt);
  yield { type: 'done', report, cached: false };
}
