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

export function recordFixture(endpoint: string, request: unknown, response: unknown): void {
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
  fs.writeFileSync(file, JSON.stringify(capped, null, 2));
}

export function replayFixture<T>(endpoint: string, request: unknown): T {
  const hash = requestHash(request);
  const entries = readFixtureFile(endpoint);
  const hit = entries.find((e) => e.requestHash === hash);
  if (!hit) throw new FixtureMiss(endpoint, hash);
  return hit.response as T;
}

export type FixtureMode = 'record' | 'replay';

export function fixtureMode(): FixtureMode {
  return process.env.DEMO_MODE === '1' ? 'replay' : 'record';
}
