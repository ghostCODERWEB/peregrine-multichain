// DEMO_MODE=1 replays recorded Nansen responses instead of calling the live
// API, so a judge with no key (or TIDE's own dev loop, out of credits) can
// still run the whole app end to end.
//
// Recording isn't a separate mode you opt into: every real call the client
// makes is mirrored to a fixture file as a side effect, for free, as part of
// normal development. By submission day the fixture library is just
// whatever endpoints TIDE actually exercised while being built, which is
// exactly the set DEMO_MODE needs to cover.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { publishableFixture } from './fixture-policy';

const FIXTURES_DIR = path.resolve(process.cwd(), 'fixtures');

interface FixtureEntry {
  requestHash: string;
  request: unknown;
  response: unknown;
  recordedAt: number;
}

function fixtureFile(endpoint: string): string {
  const slug = endpoint.replace(/\//g, '-');
  return path.join(FIXTURES_DIR, `${slug}.json`);
}

function requestHash(body: unknown): string {
  return crypto.createHash('sha1').update(JSON.stringify(body ?? {})).digest('hex');
}

function readFixtureFile(endpoint: string): FixtureEntry[] {
  const file = fixtureFile(endpoint);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as FixtureEntry[];
  } catch {
    return [];
  }
}

/** Thrown when DEMO_MODE=1 and no recorded fixture matches the request. The
 *  caller decides how to degrade (empty result, cached fallback, etc.) —
 *  this module never invents data. */
export class FixtureMiss extends Error {
  constructor(public readonly endpoint: string, public readonly hash: string) {
    super(`No recorded fixture for ${endpoint} (request ${hash.slice(0, 8)}). Run with a real NANSEN_API_KEY once to record it, or DEMO_MODE=0.`);
    this.name = 'FixtureMiss';
  }
}

export function recordFixture(endpoint: string, request: unknown, rawResponse: unknown, publicSafe = false): void {
  // FIXTURE_RECORD=0 (the local dev server): live calls leave the tracked fixtures alone.
  if (process.env.FIXTURE_RECORD === '0') return;
  // Fixtures are published with the repo: only what Nansen allows, labels stripped.
  const response = publishableFixture(endpoint, request, rawResponse, publicSafe);
  if (response === null) return;
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const file = fixtureFile(endpoint);
  const entries = readFixtureFile(endpoint);
  const hash = requestHash(request);
  const existingIdx = entries.findIndex((e) => e.requestHash === hash);
  const entry: FixtureEntry = { requestHash: hash, request, response, recordedAt: Date.now() };
  if (existingIdx >= 0) entries[existingIdx] = entry;
  else entries.push(entry);
  // Cap the library per endpoint so it stays a reasonable git-tracked size;
  // newest recordings displace the oldest once the cap is hit.
  const capped = entries.slice(-200);
  // Atomic: a concurrent reader never sees half a file.
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(capped, null, 2));
  fs.renameSync(tmp, file);
}

export function replayFixture<T>(endpoint: string, request: unknown): T {
  const hash = requestHash(request);
  const entries = readFixtureFile(endpoint);
  const hit = entries.find((e) => e.requestHash === hash) ?? sameButForDate(entries, request);
  if (!hit) throw new FixtureMiss(endpoint, hash);
  return hit.response as T;
}

/** A dated request recorded on another day: same body apart from its
 *  `date` window. Replays the newest such recording — it is still a real
 *  Nansen response for that token, just for the window it was recorded. */
function sameButForDate(entries: FixtureEntry[], request: unknown): FixtureEntry | undefined {
  if (!request || typeof request !== 'object' || !('date' in request)) return undefined;
  const strip = (b: unknown) => JSON.stringify({ ...(b as Record<string, unknown>), date: null });
  const want = strip(request);
  return entries
    .filter((e) => e.request && typeof e.request === 'object' && strip(e.request) === want)
    .sort((a, b) => b.recordedAt - a.recordedAt)[0];
}

/** The newest recording for an endpoint, whatever its request — for
 *  bodies that embed live numbers (the anchor's bulletin) and so never
 *  hash the same twice. */
export function replayLatest<T>(endpoint: string): T | null {
  const entries = readFixtureFile(endpoint);
  const newest = entries.sort((a, b) => b.recordedAt - a.recordedAt)[0];
  return newest ? (newest.response as T) : null;
}

export type FixtureMode = 'record' | 'replay';

export function fixtureMode(): FixtureMode {
  return process.env.DEMO_MODE === '1' ? 'replay' : 'record';
}

let demoClock: number | null = null;

/**
 * "Now" for building request bodies that carry dates (OHLCV windows,
 * who-bought-sold ranges). Live, it's the wall clock. In DEMO_MODE it's
 * the newest fixture's recording time, so a replay rebuilds exactly the
 * bodies that were recorded — a date that moved on would hash to a
 * request nobody recorded.
 */
export function requestNow(): number {
  if (fixtureMode() !== 'replay') return Date.now();
  if (demoClock != null) return demoClock;
  let newest = 0;
  if (fs.existsSync(FIXTURES_DIR)) {
    for (const f of fs.readdirSync(FIXTURES_DIR)) {
      if (!f.endsWith('.json')) continue;
      try {
        const entries = JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, f), 'utf8')) as FixtureEntry[];
        for (const e of entries) newest = Math.max(newest, e.recordedAt ?? 0);
      } catch { /* unreadable fixture file: skip it */ }
    }
  }
  demoClock = newest || Date.now();
  return demoClock;
}

/** YYYY-MM-DD, `daysAgo` before requestNow(). Day granularity keeps
 *  request bodies stable across a day, which is what makes both the
 *  response cache and the demo fixtures hit. */
export function requestDay(daysAgo: number): string {
  return new Date(requestNow() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}
