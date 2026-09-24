import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/server/nansen/client', () => ({ callNansen: vi.fn() }));
import { getDb } from '@/server/nansen/db';
import { callNansen } from '@/server/nansen/client';
import { prepareReplay, lockReplay, replaySnapshot } from './replay';
import { deskSummary } from './calls';
import { POST } from '@/app/api/replay/route';

const token = `0x${'1'.repeat(40)}`, due = 1_800_000_000_000, cut = due - 3_600_000, now = due + 600_000, tf = 300_000;
const pub = { mode: 'public' as const, user: null, apiKey: null, keyLast4: null, keyPlan: null };
const owner = { ...pub, mode: 'owner' as const };
const response = () => ({ data: { data: Array.from({ length: 36 }, (_, i) => ({ interval_start: new Date(cut - 24 * tf + i * tf).toISOString(), close: 100 + i })) }, meta: { cacheHit: false, creditsCost: 1 } });
beforeEach(() => {
  getDb().exec('DELETE FROM replay_sessions; DELETE FROM calls; DELETE FROM chain_cpi; DELETE FROM storm_scores; DELETE FROM token_pulse;');
  vi.clearAllMocks(); vi.stubEnv('DEMO_MODE', '0'); vi.stubEnv('TIDE_DISPLAY_MODE', 'public');
  vi.mocked(callNansen).mockResolvedValue(response() as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('server-held Time Machine', () => {
  it('does not expose future prices until an immutable scoped decision is locked', async () => {
    const p = await prepareReplay('owner', owner, 'base', token, '1h', now);
    expect(p).toMatchObject({ cut, due, entry: 123 });
    expect(p).not.toHaveProperty('outcome');
    expect(JSON.stringify(p)).not.toContain('"c":135');
    expect(p.history.every((x) => x.t + tf <= cut)).toBe(true);
    expect(deskSummary('owner').calls).toEqual([]);
    expect(() => lockReplay('desk:someone-else', pub, p.id, 'bull', 'other', null, null, now)).toThrow();
    expect(() => lockReplay('owner', pub, p.id, 'bull', 'other', null, null, now)).toThrow();
    const result = lockReplay('owner', owner, p.id, 'bull', 'momentum', 'Synthetic test decision', null, now);
    expect(result.call).toMatchObject({ source: 'replay', grade: 'won', entry: 123, exit: 135, context: { replayAt: cut } });
    expect(result.path).toHaveLength(12);
    expect(callNansen).toHaveBeenCalledTimes(1); // reveal is free
    expect(lockReplay('owner', owner, p.id, 'bull', 'other', null, null, now).call.id).toBe(result.call.id);
    expect(deskSummary('owner').calls).toHaveLength(1); // idempotent retry
    expect(deskSummary('owner').dna.bySource[0].key).toBe('Time Machine replays');
    expect(() => lockReplay('owner', owner, p.id, 'bear', 'other', null, null, now)).toThrow('already locked');
  });
  it('bounds every model snapshot by the cutoff and the viewer source', () => {
    const db = getDb();
    const insert = db.prepare("INSERT INTO chain_cpi (chain,cpi,any_cross_section,windows,snapshot_at,source) VALUES ('base',?,0,'[]',?,?)");
    insert.run(30, cut - 1, 'market-flow'); insert.run(99, cut + 1, 'market-flow'); insert.run(80, cut - 1, 'smart-money');
    const storm = db.prepare("INSERT INTO storm_scores (chain, token_address, score, band, confidence, sub_scores, missing, source, computed_at) VALUES ('base', ?, ?, 'cloudy', .5, '{}', '[]', 'test', ?)");
    storm.run(token, 20, cut - 1); storm.run(token, 90, cut + 1);
    expect(replaySnapshot('base', token, pub, cut).context).toMatchObject({ chainCpi: 30, storm: { score: 20 } });
    expect(replaySnapshot('base', token, owner, cut).context.chainCpi).toBe(80);
    expect(replaySnapshot('base', token, pub, cut - 2).readings).toEqual([]);
  });
  it('refuses expired sessions and incomplete or stale historical candles', async () => {
    const p = await prepareReplay('owner', owner, 'base', token, '1h', now);
    expect(() => lockReplay('owner', owner, p.id, 'pass', 'other', null, null, now + 2 * 3_600_000 + 1)).toThrow('expired');
    const incomplete = response(); incomplete.data.data.pop();
    vi.mocked(callNansen).mockResolvedValue(incomplete as never);
    await expect(prepareReplay('owner', owner, 'base', token, '1h', now)).rejects.toThrow('missing or stale');
  });
  it('checks invalidation and caps before spending', async () => {
    const p = await prepareReplay('owner', owner, 'base', token, '1h', now);
    expect(() => lockReplay('owner', owner, p.id, 'bull', 'other', null, 200, now)).toThrow('below');
    for (let i = 0; i < 11; i++) await prepareReplay('owner', owner, 'base', token, '1h', now);
    await expect(prepareReplay('owner', owner, 'base', token, '1h', now)).rejects.toThrow('12 replay previews');
    expect(callNansen).toHaveBeenCalledTimes(12);
  });
  it('refuses cross-site and unconfirmed previews without a paid call', async () => {
    const req = (body: unknown, origin = 'http://localhost') => new Request('http://localhost/api/replay', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await POST(req({ action: 'prepare', chain: 'base', token, horizon: '1h', confirmCredits: 1 }, 'http://localhost:9999'))).status).toBe(403);
    expect((await POST(req({ action: 'prepare', chain: 'base', token, horizon: '1h' }))).status).toBe(400);
    expect((await POST(req({ action: 'lock', id: 'a'.repeat(32), stance: 'bull', setup: 'other' }))).status).toBe(404);
    expect(callNansen).not.toHaveBeenCalled();
  });
});
