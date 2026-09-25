// The research agent (M7): Nansen's agent in expert mode, 750 credits a
// question, on the asking account's own key (the owner's, or a member's).
// The browser must acknowledge the price on every question; each account
// gets EXPERT_DAILY_CAP questions a UTC day; follow-ups continue Nansen's
// conversation. Answers are saved privately to the account: they are
// free text from Nansen's agent and can carry labels, so they are never
// published (no public share, no fixtures).
import { streamNansen } from '@/server/nansen/client';
import { getDb, audit } from '@/server/nansen/db';
import { fixtureMode } from '@/server/nansen/demo';
import type { RequestContext } from '@/server/context';
import { buildContext, composePrompt, subjectKey, type AskContext, type Subject } from './ask';

export const EXPERT_CREDITS = 750;
export const MAX_QUESTION = 2000;

export function expertScope(ctx: RequestContext): string | null {
  return ctx.user ? `user:${ctx.user.id}` : ctx.mode === 'owner' ? 'owner' : null;
}

export function expertDailyCap(): number {
  const n = Number(process.env.EXPERT_DAILY_CAP ?? 2);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 2;
}

const dayStart = (now: number) => {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
};

export function questionsToday(scope: string, now = Date.now()): number {
  return (
    getDb()
      .prepare('SELECT COUNT(*) AS n FROM expert_reports WHERE scope = ? AND created_at >= ? AND credits > 0')
      .get(scope, dayStart(now)) as { n: number }
  ).n;
}

export interface ExpertReport {
  id: number;
  question: string;
  answer: string;
  toolCalls: string[];
  conversationId: string | null;
  credits: number;
  createdAt: number;
  subject: string | null;
  context: AskContext | null;
}

type ReportRow = {
  id: number;
  question: string;
  answer: string;
  tool_calls: string;
  conversation_id: string | null;
  credits: number;
  created_at: number;
  subject: string | null;
  context: string | null;
};
const toReport = (r: ReportRow): ExpertReport => ({
  id: r.id,
  question: r.question,
  answer: r.answer,
  toolCalls: JSON.parse(r.tool_calls) as string[],
  conversationId: r.conversation_id,
  credits: r.credits,
  createdAt: r.created_at,
  subject: r.subject,
  context: r.context ? (JSON.parse(r.context) as AskContext) : null,
});

/** This account's answers, optionally only those asked from one page (L5a). */
export function listReports(scope: string, limit = 30, subject?: Subject): ExpertReport[] {
  const rows = subject
    ? getDb()
        .prepare('SELECT * FROM expert_reports WHERE scope = ? AND subject = ? ORDER BY created_at DESC LIMIT ?')
        .all(scope, subjectKey(subject), limit)
    : getDb().prepare('SELECT * FROM expert_reports WHERE scope = ? ORDER BY created_at DESC LIMIT ?').all(scope, limit);
  return (rows as ReportRow[]).map(toReport);
}

export function getReport(scope: string, id: number): ExpertReport | null {
  const r = getDb().prepare('SELECT * FROM expert_reports WHERE scope = ? AND id = ?').get(scope, id) as ReportRow | undefined;
  return r ? toReport(r) : null;
}

/** Only a conversation this account started may be continued. */
export function ownsConversation(scope: string, conversationId: string): boolean {
  return !!getDb().prepare('SELECT 1 FROM expert_reports WHERE scope = ? AND conversation_id = ? LIMIT 1').get(scope, conversationId);
}

export type ExpertEvent =
  | { type: 'tool'; name: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; report: ExpertReport }
  | { type: 'error'; message: string };

/** Everything that must hold before a single credit is spent. Returns an error or null. */
export function expertPreflight(
  ctx: RequestContext,
  question: string,
  acknowledged: number | undefined,
  conversationId: string | null,
  now = Date.now(),
): string | null {
  const scope = expertScope(ctx);
  if (!scope) return 'The research agent runs on a Nansen key: the instance owner’s, or yours once you sign in with it.';
  if (fixtureMode() === 'replay') return 'The research agent costs 750 credits a question, so the keyless demo does not run it.';
  if (acknowledged !== EXPERT_CREDITS) return `Confirm the price first: each question costs ${EXPERT_CREDITS} credits.`;
  const q = question.trim();
  if (q.length < 8) return 'Ask a full question.';
  if (q.length > MAX_QUESTION) return `Keep the question under ${MAX_QUESTION} characters.`;
  if (conversationId && !ownsConversation(scope, conversationId)) return 'That conversation belongs to another account.';
  const cap = expertDailyCap();
  if (questionsToday(scope, now) >= cap) return `This account has used its ${cap} research-agent questions for today (EXPERT_DAILY_CAP).`;
  return null;
}

/** `subject` (L5a) attaches the page's TIDE context to the first question of a
 *  conversation; follow-ups carry only the question. */
export async function* expertStream(
  ctx: RequestContext,
  question: string,
  acknowledged: number | undefined,
  conversationId: string | null,
  subject: Subject | null = null,
): AsyncGenerator<ExpertEvent> {
  const refusal = expertPreflight(ctx, question, acknowledged, conversationId);
  if (refusal) {
    yield { type: 'error', message: refusal };
    return;
  }
  const scope = expertScope(ctx)!;
  const q = question.trim();
  let text = '';
  const tools: string[] = [];
  let conversation: string | null = conversationId;
  let failed = false;
  const context = subject && !conversationId ? buildContext(subject, ctx.mode) : null;
  try {
    const body = conversationId ? { text: q, conversation_id: conversationId } : { text: context ? composePrompt(q, context) : q };
    for await (const e of streamNansen('agent/expert', body, { record: false })) {
      if (e.type === 'delta') {
        text += e.text;
        yield { type: 'delta', text: e.text };
      } else if (e.type === 'tool_call') {
        if (!tools.includes(e.name)) {
          tools.push(e.name);
          yield { type: 'tool', name: e.name };
        }
      } else if (e.type === 'finish') conversation = e.conversation_id ?? conversation;
      else if (e.type === 'error') {
        failed = true;
        yield { type: 'error', message: `Nansen agent: ${e.error}` };
        break;
      }
    }
  } catch (err) {
    failed = true;
    yield { type: 'error', message: `Nansen agent call failed: ${(err as Error).message.slice(0, 160)}` };
  }
  if (!text.trim()) return;
  const now = Date.now();
  // A partial answer after an error still cost the question: count it.
  const id = Number(
    getDb()
      .prepare(
        'INSERT INTO expert_reports (scope, question, answer, tool_calls, conversation_id, credits, created_at, subject, context) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        scope,
        q,
        text.trim(),
        JSON.stringify(tools),
        conversation,
        EXPERT_CREDITS,
        now,
        subject ? subjectKey(subject) : null,
        context ? JSON.stringify(context) : null,
      ).lastInsertRowid,
  );
  audit(ctx.user?.id ?? null, 'expert.ask', `${failed ? 'partial ' : ''}${q.slice(0, 80)}`);
  yield {
    type: 'done',
    report: {
      id,
      question: q,
      answer: text.trim(),
      toolCalls: tools,
      conversationId: conversation,
      credits: EXPERT_CREDITS,
      createdAt: now,
      subject: subject ? subjectKey(subject) : null,
      context,
    },
  };
}
