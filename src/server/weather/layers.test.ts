import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/perps/board', () => ({ perpBoard: vi.fn((view: string) => ({ at: 100, coins: [{ symbol: 'ETH', ppi: view === 'private' ? 80 : 40, openInterest: 2_000_000, sm: { secret: 'must-not-escape' } }], unavailable: null })) }));
vi.mock('@/server/sectors/weather', () => ({ sectorWeather: vi.fn((view: string) => ({ at: 200, source: view === 'private' ? 'smart-money' : 'market-flow', sectors: [{ sector: 'AI', pressure: 70, netFlow24hUsd: -100 }], unavailable: null })) }));
vi.mock('@/server/nansen/demo', () => ({ fixtureMode: vi.fn(() => 'record'), replayFixture: vi.fn() }));

import { weatherLayers, predictionReadings } from './layers';
import { writeCache } from '@/server/nansen/cache';
import { getDb } from '@/server/nansen/db';
import { fixtureMode, replayFixture } from '@/server/nansen/demo';
import { perpBoard } from '@/server/perps/board';
import { sectorWeather } from '@/server/sectors/weather';

const body = { pagination: { page: 1, per_page: 60 } };
const raw = { data: [{ category: 'Politics', total_volume_24hr: 10, total_volume_1wk: 70, address_label: 'private-label' }] };
beforeEach(() => { getDb().exec('DELETE FROM response_cache'); vi.mocked(fixtureMode).mockReturnValue('record'); });

describe('home weather layers', () => {
  it('normalizes prediction volume without leaking raw fields or inventing directional flow', () => {
    expect(predictionReadings(raw)).toEqual([{ name: 'Politics', score: 50, value: 10 }]);
    expect(predictionReadings(null)).toEqual([]);
    expect(predictionReadings({ data: [null, {}, { category: 'x', total_volume_24hr: -1, total_volume_1wk: 1 }, { category: 'y', total_volume_24hr: 1, total_volume_1wk: 0 }] })).toEqual([]);
  });
  it('keeps public and owner inputs separate and returns only normalized fields', () => {
    const layers = weatherLayers('public', 300);
    expect(perpBoard).toHaveBeenLastCalledWith('public', 300);
    expect(sectorWeather).toHaveBeenLastCalledWith('public', 300);
    expect(layers[0].readings[0].score).toBe(40);
    expect(JSON.stringify(layers)).not.toContain('must-not-escape');
    expect(layers[1].readings[0]).toMatchObject({ score: 70, value: -100 });
    expect(weatherLayers('private', 300)[0].readings[0].score).toBe(80);
  });
  it('uses the shared category cache but never reads a member partition', () => {
    writeCache('prediction-market/categories', body, raw, 'member-a');
    expect(weatherLayers('public')[2].readings).toEqual([]);
    writeCache('prediction-market/categories', body, raw);
    const p = weatherLayers('public')[2];
    expect(p.readings).toHaveLength(1);
    expect(p.at).toBeGreaterThan(0);
    expect(p.recorded).toBe(false);
    expect(p.description).toContain('Not net YES/NO flow');
  });
  it('does not serve expired predictions as fresh', () => {
    writeCache('prediction-market/categories', body, raw);
    getDb().prepare('UPDATE response_cache SET expires_at = 1').run();
    expect(weatherLayers('public')[2]).toMatchObject({ readings: [], at: null });
  });
  it('marks fixture replay as recorded rather than assigning a fresh timestamp', () => {
    vi.mocked(fixtureMode).mockReturnValue('replay');
    vi.mocked(replayFixture).mockReturnValue(raw);
    expect(weatherLayers('public')[2]).toMatchObject({ recorded: true, at: null, readings: [{ name: 'Politics', score: 50, value: 10 }] });
    vi.mocked(replayFixture).mockImplementation(() => { throw new Error('missing'); });
    expect(weatherLayers('public')[2].readings).toEqual([]);
  });
});
