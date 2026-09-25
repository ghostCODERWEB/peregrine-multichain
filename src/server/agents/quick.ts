// Ask Nansen on a token page: a visitor's own question, answered by Nansen's
// fast agent (agent/fast, ~200 credits) from the scores Peregrine computed
// for that token. The same question about the same token within an hour is
// answered from the cache for free, and public views share a site-wide daily
// cap (ASK_QUICK_DAILY_CAP, default 3) so one visitor can't spend the
// operator's budget. Answers asked in the owner view never reach public ones.
//
// Public answers must not carry Nansen wallet labels or smart-money activity
// (redistribution guide: address labels are prohibited in public views, and
// an agent relaying smart-money trades is its own counter-example). The fast
// agent can't be told which tools to use, so a public answer is held until it
// is complete, and one that drew on any tool is replaced by a plain reading
// of Peregrine's own scores, saying why.
import { getDb } from '@/server/nansen/db';
import { streamNansen } from '@/server/nansen/client';
import { RULES, tokenPrompt } from './anchor';
import { utcDayStart } from '@/server/site';
import type { DisplayMode } from '@/server/mode';

export const QUICK_CREDITS = 200;
export const QUICK_TTL_MS = 60 * 60_000;
export const quickDailyCap = (): number => {
  const n = Number(process.env.ASK_QUICK_DAILY_CAP ?? 3);
  return Number.isFinite(n) && n >= 0 ? n : 3;
};

export interface QuickAnswer {
  question: string;
  text: string;
  toolCalls: string[];
  createdAt: number;
  cached?: boolean;
}
export type QuickEvent =
  | { type: 'tool'; name: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; answer: QuickAnswer }
  | { type: 'error'; message: string };

export const quickSubject = (chain: string, token: string, mode: DisplayMode) =>
  `token:${chain}:${token.toLowerCase()}${mode === 'owner' ? '' : ':public'}`;
/** Case, spacing and trailing punctuation don't make a new question. */
export const normQuestion = (q: string) =>
  q
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[?!.\s]+$/, '')
    .trim();

/** Public questions actually sent to Nansen since 00:00 UTC (cache hits are free). */
export function publicQuestionsToday(now = Date.now()): number {
  return (
    getDb()
      .prepare('SELECT COUNT(*) AS n FROM quick_answers WHERE public = 1 AND credits > 0 AND created_at >= ?')
      .get(utcDayStart(now)) as { n: number }
  ).n;
}

export function recentAnswers(subject: string, limit = 6): QuickAnswer[] {
  const rows = getDb()
    .prepare('SELECT question, text, tool_calls, created_at FROM quick_answers WHERE subject = ? ORDER BY id DESC LIMIT ?')
    .all(subject, limit) as Array<{ question: string; text: string; tool_calls: string; created_at: number }>;
  return rows
    .reverse()
    .map((r) => ({ question: r.question, text: r.text, toolCalls: JSON.parse(r.tool_calls) as string[], createdAt: r.created_at }));
}

export async function* quickAsk(
  chain: string,
  token: string,
  question: string,
  mode: DisplayMode,
  now = Date.now(),
): AsyncGenerator<QuickEvent> {
  const subject = quickSubject(chain, token, mode);
  const norm = normQuestion(question);
  const hit = getDb()
    .prepare(
      'SELECT question, text, tool_calls, created_at FROM quick_answers WHERE subject = ? AND question_norm = ? AND created_at >= ? ORDER BY id DESC LIMIT 1',
    )
    .get(subject, norm, now - QUICK_TTL_MS) as { question: string; text: string; tool_calls: string; created_at: number } | undefined;
  if (hit) {
    const answer: QuickAnswer = {
      question: hit.question,
      text: hit.text,
      toolCalls: JSON.parse(hit.tool_calls),
      createdAt: hit.created_at,
      cached: true,
    };
    yield { type: 'delta', text: hit.text };
    yield { type: 'done', answer };
    return;
  }
  const isPublic = mode !== 'owner';
  const cap = quickDailyCap();
  if (isPublic && publicQuestionsToday(now) >= cap) {
    yield {
      type: 'error',
      message: `Today’s ${cap} public Ask Nansen question${cap === 1 ? '' : 's'} have been used. Answers already given stay here; new questions open again at 00:00 UTC.`,
    };
    return;
  }
  const built = tokenPrompt(chain, token);
  if (!built) {
    yield { type: 'error', message: 'Nansen needs this token’s scores first: wait for the Dump Risk to finish loading, then ask again.' };
    return;
  }
  const publicRules = isPublic
    ? ' Answer only from the JSON below and do not call any tools. Never name a wallet, address, entity, fund, exchange or label, and never describe what smart-money wallets bought or sold.'
    : '';
  const prompt = `You are Ask Nansen inside Peregrine, answering a visitor's question about one token from Nansen data. ${RULES.replace('Write exactly four sentences', 'Answer in at most four sentences')}${publicRules}\nPeregrine's scores for the token:\n${JSON.stringify(built.facts)}\nThe visitor asks: ${JSON.stringify(question.slice(0, 300))}\nIf the question can't be answered from these scores, say so briefly.`;

  let text = '';
  const tools: string[] = [];
  try {
    for await (const e of streamNansen('agent/fast', { text: prompt }, { record: false })) {
      // Public answers are held until checked; the owner's stream live.
      if (e.type === 'delta') {
        text += e.text;
        if (!isPublic) yield { type: 'delta', text: e.text };
      } else if (e.type === 'tool_call') {
        if (!tools.includes(e.name)) {
          tools.push(e.name);
          if (!isPublic) yield { type: 'tool', name: e.name };
        }
      } else if (e.type === 'error') {
        yield { type: 'error', message: `Nansen agent: ${e.error}` };
        return;
      }
    }
  } catch (err) {
    yield { type: 'error', message: (err as Error).message.slice(0, 300) };
    return;
  }
  if (!text.trim()) {
    yield { type: 'error', message: 'Nansen’s agent returned no answer. Try rephrasing.' };
    return;
  }
  if (isPublic && tools.length) text = scoresOnly(built.facts);
  if (isPublic) yield { type: 'delta', text };
  getDb()
    .prepare(
      'INSERT INTO quick_answers (subject, question_norm, question, text, tool_calls, credits, public, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(subject, norm, question.slice(0, 300), text, JSON.stringify(tools), QUICK_CREDITS, isPublic ? 1 : 0, now);
  yield { type: 'done', answer: { question, text, toolCalls: tools, createdAt: now } };
}

/** The public fallback when the agent reached for wallet-level data: what
 *  Peregrine's own (public) scores say, with the reason stated. */
export function scoresOnly(facts: unknown): string {
  const f = facts as { token?: string | null; storm_score?: number; band?: string; sub_scores_0_to_100?: Record<string, number | null> };
  const name = f.token ?? 'This token';
  const subs = Object.entries(f.sub_scores_0_to_100 ?? {})
    .filter(([, v]) => v != null)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()} ${v}`);
  const band = f.band
    ? (({ clear: 'Low', cloudy: 'Moderate', watch: 'High', warning: 'Critical' } as Record<string, string>)[f.band] ?? f.band)
    : null;
  return `Nansen's full answer drew on wallet-level data that its rules keep out of public pages, so here is what Peregrine's own scores say. ${name}'s 7-day Dump Risk is ${f.storm_score ?? 'unscored'}${band ? ` (${band})` : ''}${subs.length ? `, led by ${subs.join(', ')} out of 100` : ''}. Readings, not financial advice.`;
}
