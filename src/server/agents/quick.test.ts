import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'node:fs';

const dir = await vi.hoisted(async () => {
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  const d = f.mkdtempSync(p.join(o.tmpdir(), 'tide-quick-'));
  process.env.TIDE_DB_PATH = p.join(d, 'quick.db');
  return d;
});

const calls: string[] = [];
let useTool = false;
vi.mock('@/server/nansen/client', () => ({
  streamNansen: async function* (_e: string, body: { text: string }) {
    calls.push(body.text);
    if (useTool) yield { type: 'tool_call', name: 'token_who_bought_sold' };
    yield { type: 'delta', text: useTool ? 'Wintermute bought $5M.' : 'Liquidity is thin.' };
  },
}));

import { getDb } from '@/server/nansen/db';
import { quickAsk, normQuestion, publicQuestionsToday, recentAnswers, quickSubject } from './quick';

const NOW = Date.UTC(2026, 8, 25, 12);
const drain = async (g: AsyncGenerator<{ type: string }>) => { const out = []; for await (const e of g) out.push(e); return out; };
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => {
  calls.length = 0;
  useTool = false;
  delete process.env.ASK_QUICK_DAILY_CAP;
  getDb().exec('DELETE FROM quick_answers; DELETE FROM storm_scores;');
  getDb().prepare(`INSERT INTO storm_scores (chain, token_address, symbol, score, band, confidence, sub_scores, missing, market_cap_usd, price_usd, source, computed_at)
    VALUES ('base', '0xaero000000000000000000000000000000000000', 'AERO', 40, 'cloudy', 1, '{"exitLiquidity":75}', '[]', 700000000, null, 'page', ?)`).run(NOW);
});
const T = '0xaero000000000000000000000000000000000000';

describe('quick Ask Nansen', () => {
  it('normalises questions so small differences reuse one answer', () => {
    expect(normQuestion('  Who is BUYING  AERO?? ')).toBe('who is buying aero');
  });

  it('answers from Nansen once, then from the cache for an hour', async () => {
    const a = await drain(quickAsk('base', T, 'Who is buying AERO?', 'public', NOW));
    expect(a.at(-1)).toMatchObject({ type: 'done' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('Who is buying AERO?');
    const b = await drain(quickAsk('base', T, 'who is buying aero', 'public', NOW + 60_000));
    expect(b.at(-1)).toMatchObject({ type: 'done', answer: { cached: true } });
    expect(calls).toHaveLength(1); // no second Nansen call
    expect(publicQuestionsToday(NOW)).toBe(1);
    expect(recentAnswers(quickSubject('base', T, 'public'))).toHaveLength(1);
  });

  it('stops public questions at the daily cap, but never the owner', async () => {
    process.env.ASK_QUICK_DAILY_CAP = '2';
    await drain(quickAsk('base', T, 'question one', 'public', NOW));
    await drain(quickAsk('base', T, 'question two', 'public', NOW));
    const third = await drain(quickAsk('base', T, 'question three', 'public', NOW));
    expect(third).toEqual([expect.objectContaining({ type: 'error', message: expect.stringContaining('2 public Ask Nansen questions') })]);
    expect(calls).toHaveLength(2);
    const owner = await drain(quickAsk('base', T, 'question three', 'owner', NOW));
    expect(owner.at(-1)).toMatchObject({ type: 'done' });
  });

  it('keeps owner answers out of the public view', async () => {
    await drain(quickAsk('base', T, 'owner only question', 'owner', NOW));
    expect(recentAnswers(quickSubject('base', T, 'public'))).toEqual([]);
    expect(recentAnswers(quickSubject('base', T, 'owner'))).toHaveLength(1);
  });

  it('asks the visitor to wait when the token has no scores yet', async () => {
    const r = await drain(quickAsk('base', '0x' + '1'.repeat(40), 'anything useful', 'public', NOW));
    expect(r[0]).toMatchObject({ type: 'error' });
    expect(calls).toHaveLength(0);
  });
  it('never shows a public visitor an answer that used the agent’s tools (labels, smart money)', async () => {
    useTool = true;
    const pub = await drain(quickAsk('base', T, 'who is buying?', 'public', NOW));
    const text = pub.filter((e) => e.type === 'delta').map((e) => (e as unknown as { text: string }).text).join('');
    expect(text).not.toContain('Wintermute');
    expect(text).toContain('keep out of public pages');
    expect(text).toContain('Dump Risk is 40 (Moderate)');
    expect(pub.some((e) => e.type === 'tool')).toBe(false);
    expect(calls[0]).toContain('do not call any tools');
    // The owner sees Nansen's own answer, streamed.
    const own = await drain(quickAsk('base', T, 'who is buying?', 'owner', NOW));
    expect(own.filter((e) => e.type === 'delta').map((e) => (e as unknown as { text: string }).text).join('')).toContain('Wintermute');
  });
});
