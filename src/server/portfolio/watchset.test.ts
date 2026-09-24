import { afterAll, expect, it, vi } from 'vitest';
import fs from 'node:fs';
const dir = await vi.hoisted(async () => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tide-watchset-'));
  process.env.TIDE_DB_PATH = path.join(d, 'test.db');
  process.env.DEMO_MODE = '0';
  return d;
});
import { readWatchset, saveWatchset, watchScope } from './watchset';
import { getDb } from '@/server/nansen/db';
afterAll(() => { getDb().close(); fs.rmSync(dir, { recursive: true, force: true }); });
const a = '0x1111111111111111111111111111111111111111', b = '0x2222222222222222222222222222222222222222';
it('isolates two users and replaces only the selected watch set', () => {
  saveWatchset('user:1', [a], 1); saveWatchset('user:2', [b], 2);
  expect(readWatchset('user:1')).toEqual([a]);
  saveWatchset('user:1', [], 1);
  expect(readWatchset('user:1')).toEqual([]);
  expect(readWatchset('user:2')).toEqual([b]);
});
it('rejects invalid input without erasing an existing set', () => {
  saveWatchset('owner', [a], null);
  expect(() => saveWatchset('owner', ['invalid'], null)).toThrow();
  expect(readWatchset('owner')).toEqual([a]);
});
it('does not give an anonymous public visitor an owner scope', () => {
  const ctx = { mode: 'public' as const, user: null, apiKey: null, keyLast4: null, keyPlan: null };
  expect(watchScope(ctx)).toBeNull();
  expect(watchScope({ ...ctx, mode: 'owner' })).toBe('owner');
});
