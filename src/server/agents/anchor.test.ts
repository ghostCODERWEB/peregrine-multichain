import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'node:fs';

const dir = await vi.hoisted(async () => {
  // A fresh database seeded from the recorded demo history (fixtures/), so the test runs on any clean checkout.
  const [f, p, o] = await Promise.all([import('node:fs'), import('node:path'), import('node:os')]);
  const d = f.mkdtempSync(p.join(o.tmpdir(), 'tide-anchor-'));
  process.env.TIDE_DB_PATH = p.join(d, 'anchor.db');
  const prev = process.env.DEMO_MODE;
  process.env.DEMO_MODE = '1';
  (await import('@/server/nansen/db')).getDb();
  if (prev === undefined) delete process.env.DEMO_MODE; else process.env.DEMO_MODE = prev;
  return d;
});

const prompts: string[] = [];
vi.mock('@/server/nansen/client', () => ({
  streamNansen: async function* (_e: string, body: { text: string }) {
    prompts.push(body.text);
    yield { type: 'tool_call', name: 'token_screener' };
    yield { type: 'delta', text: 'Flow leans to Base.' };
    yield { type: 'finish', conversation_id: 'c1' };
  },
}));

import { getDb } from '@/server/nansen/db';
import { anchorStream, latestReport, callsThisHour, subjectKey } from './anchor';

const drain = async (g: AsyncGenerator<{ type: string }>) => { const o = []; for await (const e of g) o.push(e); return o; };
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => { prompts.length = 0; process.env.ANCHOR_MAX_PER_HOUR = '2'; getDb().exec('DELETE FROM anchor_reports;'); });

describe('market brief (anchor)', () => {
  it('keys reports per view so private briefs never reach public viewers', () => {
    expect(subjectKey('bulletin', 'owner')).toBe('bulletin');
    expect(subjectKey('bulletin', 'public')).toBe('bulletin:public');
    expect(subjectKey('token', 'member', 'base', '0xABC')).toBe('token:base:0xabc:public');
  });

  it('generates a bulletin from Peregrine readings, then serves it from cache within the hour', async () => {
    const first = await drain(anchorStream('bulletin', 'public'));
    expect(first.at(-1)).toMatchObject({ type: 'done' });
    expect(prompts[0]).toContain('Flow Index');
    expect(latestReport(subjectKey('bulletin', 'public'))?.text).toBe('Flow leans to Base.');
    const again = await drain(anchorStream('bulletin', 'public'));
    expect(again.at(-1)).toMatchObject({ type: 'done', cached: true });
    expect(prompts).toHaveLength(1);
    expect(callsThisHour()).toBe(1);
  });

  it('stops at the hourly cap and says so', async () => {
    process.env.ANCHOR_MAX_PER_HOUR = '0';
    const r = await drain(anchorStream('bulletin', 'owner'));
    expect(r[0]).toMatchObject({ type: 'error' });
    expect(prompts).toHaveLength(0);
  });

  it('asks for the token page first when a token has no Dump Risk yet', async () => {
    const r = await drain(anchorStream('token', 'public', 'base', '0x' + '9'.repeat(40)));
    expect(r[0]).toMatchObject({ type: 'error' });
  });
});
