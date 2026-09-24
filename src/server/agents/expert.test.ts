import { describe, it, expect, beforeEach, vi } from 'vitest';

// A throwaway database: getDb() reads TIDE_DB_PATH when it first opens.
await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  process.env.TIDE_DB_PATH = p.join(f.mkdtempSync(p.join(o.tmpdir(), 'tide-expert-')), 'expert.db');
});
import { getDb } from '@/server/nansen/db';
import { expertPreflight, questionsToday, EXPERT_CREDITS } from './expert';
import type { RequestContext } from '@/server/context';

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
