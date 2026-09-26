// The Perps terminal's context-aware analyst. The page sends what the user is
// looking at (coin, cohort and side filters, the selected liquidation band,
// the positions in view, the cohort matrix, What Changed); this module turns
// it into a prompt for Nansen's Research Agent and streams the answer back.
//
// Modes: quick = agent/fast (200 credits), deep = agent/expert (750 credits,
// shares the expert daily cap and needs the price acknowledged). Follow-ups
// pass the agent's conversation_id so the investigation keeps its context.
// Owner and members only: the context holds labels and cohort data Nansen does
// not allow in public views.
import { streamNansen } from '@/server/nansen/client';
import { getDb, audit } from '@/server/nansen/db';
import type { RequestContext } from '@/server/context';
import { EXPERT_CREDITS, expertDailyCap, expertScope, questionsToday } from './expert';

export const QUICK_CREDITS = 200;
export const MAX_CONTEXT_CHARS = 14_000;

export type AnalystEvent =
  | { type: 'tool'; name: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; conversationId: string | null; credits: number; tools: string[] }
  | { type: 'error'; message: string };

const RULES = [
  'Describe what the data shows; never advise buying, selling or trading, and never predict price.',
  'Say "observed" for exposure: the positions are the largest ones Nansen returns per cohort, not the whole exchange.',
  'Cite every wallet by its full 0x address (with its label if the context has one), so the page can link it.',
  'Write price ranges as "$93,400 to $94,000" and coins as tickers (BTC), so the page can link them.',
  'Use numbers from the context or from your Nansen tools; if something is not in the data, say so.',
  'Be concise: a short answer, then a line starting "Evidence:" naming the datasets and time window you used.',
].join(' ');

export function analystPreflight(ctx: RequestContext, depth: 'quick' | 'deep', acknowledged: number | undefined): string | null {
  if (ctx.mode === 'public') return 'The analyst works with wallet labels and Smart Money cohorts, which Nansen allows only in the key owner\'s view.';
  if (depth === 'deep') {
    const scope = expertScope(ctx);
    if (!scope) return 'Deep investigation needs the key owner or a signed-in member.';
    if (acknowledged !== EXPERT_CREDITS) return `A deep investigation costs ${EXPERT_CREDITS} credits; confirm the price first.`;
    if (questionsToday(scope) >= expertDailyCap()) return `Today's ${expertDailyCap()} deep investigations are used; quick analysis is still available.`;
  }
  return null;
}

export function analystPrompt(symbol: string, question: string, context: unknown): string {
  const json = JSON.stringify(context);
  const ctxText = json.length > MAX_CONTEXT_CHARS ? `${json.slice(0, MAX_CONTEXT_CHARS)}…(truncated)` : json;
  return `You are the analyst inside Peregrine's Perps Intelligence Terminal, built on Nansen data. The user is looking at the ${symbol} Hyperliquid perp. ${RULES}\n\nWhat the user's screen shows (JSON; filters, selected liquidation band, positions in view, cohort matrix, recent changes):\n${ctxText}\n\nQuestion: ${question}`;
}

export async function* perpsAnalyst(
  ctx: RequestContext,
  opts: { symbol: string; question: string; context: unknown; depth: 'quick' | 'deep'; conversationId: string | null; acknowledged?: number },
): AsyncGenerator<AnalystEvent> {
  const refusal = analystPreflight(ctx, opts.depth, opts.acknowledged);
  if (refusal) {
    yield { type: 'error', message: refusal };
    return;
  }
  const endpoint = opts.depth === 'deep' ? 'agent/expert' : 'agent/fast';
  const credits = opts.depth === 'deep' ? EXPERT_CREDITS : QUICK_CREDITS;
  // A follow-up carries the new question plus the refreshed screen; the agent keeps the thread.
  const text = analystPrompt(opts.symbol, opts.question, opts.context);
  const body = opts.conversationId ? { text, conversation_id: opts.conversationId } : { text };
  let answer = '';
  let conversation = opts.conversationId;
  const tools: string[] = [];
  try {
    for await (const e of streamNansen(endpoint, body, { record: false })) {
      if (e.type === 'delta') {
        answer += e.text;
        yield { type: 'delta', text: e.text };
      } else if (e.type === 'tool_call') {
        if (!tools.includes(e.name)) {
          tools.push(e.name);
          yield { type: 'tool', name: e.name };
        }
      } else if (e.type === 'finish') conversation = e.conversation_id ?? conversation;
      else if (e.type === 'error') {
        yield { type: 'error', message: `Nansen agent: ${e.error}` };
        break;
      }
    }
  } catch (err) {
    yield { type: 'error', message: `Nansen agent call failed: ${(err as Error).message.slice(0, 160)}` };
  }
  if (!answer.trim()) return;
  if (opts.depth === 'deep') {
    // Recorded with the expert reports so the shared daily cap counts it.
    getDb()
      .prepare('INSERT INTO expert_reports (scope, question, answer, tool_calls, conversation_id, credits, created_at, subject, context) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(expertScope(ctx), opts.question.slice(0, 2000), answer.trim(), JSON.stringify(tools), conversation, EXPERT_CREDITS, Date.now(), `perps:${opts.symbol}`, null);
  } else {
    // Kept so a paid answer survives a reload (private: never shown publicly).
    getDb()
      .prepare('INSERT INTO quick_answers (subject, question_norm, question, text, tool_calls, credits, public, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)')
      .run(`perps:${opts.symbol}`, opts.question.toLowerCase().slice(0, 300), opts.question.slice(0, 300), answer.trim(), JSON.stringify(tools), QUICK_CREDITS, Date.now());
  }
  audit(ctx.user?.id ?? null, `perps.ask.${opts.depth}`, `${opts.symbol}: ${opts.question.slice(0, 80)}`);
  yield { type: 'done', conversationId: conversation, credits, tools };
}

export interface SavedAnswer { question: string; text: string; tools: string[]; credits: number; depth: 'quick' | 'deep'; createdAt: number; conversationId: string | null }

/** The analyst's recent answers for one coin, newest first (owner and members only). */
export function savedAnswers(symbol: string, limit = 8): SavedAnswer[] {
  const db = getDb();
  const deep = (db.prepare("SELECT question, answer AS text, tool_calls, credits, created_at, conversation_id FROM expert_reports WHERE subject = ? ORDER BY id DESC LIMIT ?").all(`perps:${symbol}`, limit) as Array<{ question: string; text: string; tool_calls: string; credits: number; created_at: number; conversation_id: string | null }>)
    .map((r) => ({ question: r.question, text: r.text, tools: JSON.parse(r.tool_calls) as string[], credits: r.credits, depth: 'deep' as const, createdAt: r.created_at, conversationId: r.conversation_id }));
  const quick = (db.prepare("SELECT question, text, tool_calls, credits, created_at FROM quick_answers WHERE subject = ? AND public = 0 ORDER BY id DESC LIMIT ?").all(`perps:${symbol}`, limit) as Array<{ question: string; text: string; tool_calls: string; credits: number; created_at: number }>)
    .map((r) => ({ question: r.question, text: r.text, tools: JSON.parse(r.tool_calls) as string[], credits: r.credits, depth: 'quick' as const, createdAt: r.created_at, conversationId: null }));
  return [...deep, ...quick].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
}

/** "Explain this view" for any page module: the module's own data in, a short
 *  evidence-led explanation out (agent/fast, 200 credits, owner and members). */
export async function* explainView(ctx: RequestContext, view: string, context: unknown, question?: string | null): AsyncGenerator<AnalystEvent> {
  if (ctx.mode === 'public') { yield { type: 'error', message: 'Explanations use wallet labels and Smart Money data, which Nansen allows only in the key owner\'s view.' }; return; }
  const json = JSON.stringify(context);
  const ask = question?.trim()
    ? `Answer this question about it: "${question.trim().slice(0, 500)}". Lead with the direct answer.`
    : 'Structure: what changed, which wallets or tokens drove it, which metrics support that, and the timeframe.';
  const text = `You are Peregrine's analyst inside a Nansen-powered intelligence terminal. The user is looking at: ${view}. ${RULES} ${ask} Use the data below first; call a Nansen tool only to verify or fill a gap.\n\nData (JSON):\n${json.length > MAX_CONTEXT_CHARS ? `${json.slice(0, MAX_CONTEXT_CHARS)}…(truncated)` : json}`;
  let answer = '';
  const tools: string[] = [];
  try {
    for await (const e of streamNansen('agent/fast', { text }, { record: false })) {
      if (e.type === 'delta') { answer += e.text; yield { type: 'delta', text: e.text }; }
      else if (e.type === 'tool_call' && !tools.includes(e.name)) { tools.push(e.name); yield { type: 'tool', name: e.name }; }
      else if (e.type === 'error') { yield { type: 'error', message: `Nansen agent: ${e.error}` }; return; }
    }
  } catch (err) {
    yield { type: 'error', message: `Nansen agent call failed: ${(err as Error).message.slice(0, 160)}` };
    return;
  }
  if (!answer.trim()) return;
  getDb().prepare('INSERT INTO quick_answers (subject, question_norm, question, text, tool_calls, credits, public, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)')
    .run(`explain:${view}`, 'explain this view', 'Explain this view', answer.trim(), JSON.stringify(tools), QUICK_CREDITS, Date.now());
  audit(ctx.user?.id ?? null, 'explain.view', view);
  yield { type: 'done', conversationId: null, credits: QUICK_CREDITS, tools };
}
