import { describe, it, expect, beforeEach, vi } from 'vitest';

// A throwaway database: getDb() reads TIDE_DB_PATH when it first opens.
await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  process.env.TIDE_DB_PATH = p.join(f.mkdtempSync(p.join(o.tmpdir(), 'tide-expert-')), 'expert.db');
});
vi.mock('@/server/nansen/client', () => ({ streamNansen: vi.fn() }));
import { getDb } from '@/server/nansen/db';
import { expertPreflight, questionsToday, expertStream, listReports, EXPERT_CREDITS } from './expert';
import { streamNansen } from '@/server/nansen/client';
import type { RequestContext } from '@/server/context';

async function* asStream(...events: Array<{ type: string } & Record<string, unknown>>) {
  for (const e of events) yield e as never;
}

const owner = { mode: 'owner', user: null } as unknown as RequestContext;
const member = { mode: 'member', user: { id: 7 } } as unknown as RequestContext;
const pub = { mode: 'public', user: null } as unknown as RequestContext;
const Q = 'Which chains are smart money rotating into this week?';

describe('research agent preflight', () => {
  beforeEach(() => {
    getDb().prepare("DELETE FROM expert_reports WHERE scope IN ('owner', 'user:7')").run();
    delete process.env.EXPERT_DAILY_CAP;
  });

  it('refuses public visitors and questions whose price was not confirmed', () => {
    expect(expertPreflight(pub, Q, EXPERT_CREDITS, null)).toMatch(/runs on a Nansen key/);
    expect(expertPreflight(owner, Q, undefined, null)).toMatch(/Confirm the price/);
    expect(expertPreflight(owner, Q, 200, null)).toMatch(/750 credits/);
    expect(expertPreflight(owner, Q, EXPERT_CREDITS, null)).toBeNull();
  });

  it('caps questions per account per UTC day', () => {
    process.env.EXPERT_DAILY_CAP = '1';
    const now = Date.now();
    getDb().prepare('INSERT INTO expert_reports (scope, question, answer, tool_calls, conversation_id, credits, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('owner', Q, 'a', '[]', 'c1', EXPERT_CREDITS, now);
    expect(questionsToday('owner', now)).toBe(1);
    expect(expertPreflight(owner, Q, EXPERT_CREDITS, null, now)).toMatch(/used its 1 research-agent questions/);
    // Another account has its own allowance.
    expect(expertPreflight(member, Q, EXPERT_CREDITS, null, now)).toBeNull();
  });

  it('lets an account continue only its own conversations', () => {
    getDb().prepare('INSERT INTO expert_reports (scope, question, answer, tool_calls, conversation_id, credits, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('owner', Q, 'a', '[]', 'conv-owner', EXPERT_CREDITS, 0);
    expect(expertPreflight(member, Q, EXPERT_CREDITS, 'conv-owner')).toMatch(/another account/);
    expect(expertPreflight(owner, Q, EXPERT_CREDITS, 'conv-owner')).toBeNull();
  });

  it('rejects empty and oversized questions', () => {
    expect(expertPreflight(owner, 'hi', EXPERT_CREDITS, null)).toMatch(/full question/);
    expect(expertPreflight(owner, 'x'.repeat(2001), EXPERT_CREDITS, null)).toMatch(/under 2000/);
  });
});

describe('Ask Nansen: context on the first question only (L5a)', () => {
  const T = '0x940181a94a35a4569e4529a3cdfb74e38fd98631';
  const subject = { kind: 'token' as const, chain: 'base', address: T };

  beforeEach(() => {
    getDb().exec("DELETE FROM expert_reports WHERE scope = 'owner'; DELETE FROM storm_scores; DELETE FROM token_pulse; DELETE FROM chain_cpi;");
    vi.mocked(streamNansen).mockReset();
  });

  it('fences the page context into the first question, and stores subject + context on the report', async () => {
    getDb().prepare("INSERT INTO storm_scores (chain, token_address, symbol, score, band, confidence, sub_scores, missing, source, computed_at) VALUES ('base', ?, 'AERO', 40, 'Cloudy', 0.7, '{}', '[]', 'live', ?)").run(T, Date.now());
    vi.mocked(streamNansen).mockImplementation(() => asStream({ type: 'delta', text: 'Answer.' }, { type: 'finish', conversation_id: 'conv-1', tool_calls: [] }));
    const events: Array<{ type: string; report?: { subject: string | null; context: unknown } }> = [];
    for await (const e of expertStream(owner, 'What do you see?', EXPERT_CREDITS, null, subject)) events.push(e);
    const [sentEndpoint, sentBody] = vi.mocked(streamNansen).mock.calls[0];
    expect(sentEndpoint).toBe('agent/expert');
    expect((sentBody as { text: string }).text).toContain('<tide_context>');
    expect((sentBody as { text: string }).text).toContain('Dump Risk');
    const done = events.find((e) => e.type === 'done')!;
    expect(done.report!.subject).toBe(JSON.stringify({ kind: 'token', chain: 'base', address: T }));
    expect(done.report!.context).toMatchObject({ view: 'private' });
    expect(listReports('owner', 30, subject)).toHaveLength(1);
    expect(listReports('owner', 30, { kind: 'chain', chain: 'ethereum' })).toHaveLength(0);
  });

  it('a follow-up in the same conversation sends only the question, no context resend', async () => {
    getDb().prepare('INSERT INTO expert_reports (scope, question, answer, tool_calls, conversation_id, credits, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('owner', 'first', 'a', '[]', 'conv-1', EXPERT_CREDITS, Date.now());
    vi.mocked(streamNansen).mockImplementation(() => asStream({ type: 'delta', text: 'More.' }, { type: 'finish', conversation_id: 'conv-1', tool_calls: [] }));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- draining the generator, its events are irrelevant here
    for await (const _e of expertStream(owner, 'Follow up', EXPERT_CREDITS, 'conv-1', subject)) { /* drain */ }
    const [, sentBody] = vi.mocked(streamNansen).mock.calls[0];
    expect(sentBody).toEqual({ text: 'Follow up', conversation_id: 'conv-1' });
  });

  it('with no subject, behaves exactly like a plain question (no context fence)', async () => {
    vi.mocked(streamNansen).mockImplementation(() => asStream({ type: 'delta', text: 'Plain.' }, { type: 'finish', conversation_id: 'conv-2', tool_calls: [] }));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- draining the generator, its events are irrelevant here
    for await (const _e of expertStream(owner, 'Plain question here', EXPERT_CREDITS, null)) { /* drain */ }
    const [, sentBody] = vi.mocked(streamNansen).mock.calls[0];
    expect(sentBody).toEqual({ text: 'Plain question here' });
  });
});
