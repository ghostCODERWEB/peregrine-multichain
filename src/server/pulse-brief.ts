// Written briefs over derived insights: Nansen's agent (agent/fast) summarizes a
// page's signals in three short sentences. One brief per page key is shared by
// every view: cached in kv, regenerated only when the data changed and the brief is older than
// BRIEF_TTL_HOURS (default 6). Each rewrite is a 200-credit agent call, so briefs are the costliest part of a page view.
import { createHash } from 'node:crypto';
import { streamNansen } from '@/server/nansen/client';
import { getKv, setKv } from '@/server/nansen/db';
import type { PulseItem } from '@/server/pulse';

const TTL = Math.max(1, Number(process.env.BRIEF_TTL_HOURS) || 6) * 3_600_000;
export interface PulseBrief { text: string; at: number }
const inflight = new Map<string, Promise<PulseBrief | null>>();
const kvKey = (key: string) => (key === 'pulse' ? 'pulse:brief' : `brief:${key}`);

export function cachedBrief(key = 'pulse'): PulseBrief | null {
  const v = getKv(kvKey(key));
  try { return v ? (JSON.parse(v.value) as PulseBrief) : null; } catch { return null; }
}

export async function aiBrief(key: string, items: PulseItem[], subject = 'the crypto market'): Promise<PulseBrief | null> {
  const sig = createHash('sha1').update(items.map((i) => i.text).join('|')).digest('hex');
  const cur = getKv(kvKey(key));
  const prev = cur ? (JSON.parse(cur.value) as PulseBrief & { sig: string }) : null;
  if (prev && (prev.sig === sig || Date.now() - prev.at < TTL)) return { text: prev.text, at: prev.at };
  if (!items.length) return prev;
  const running = inflight.get(key);
  // Stale-while-revalidate: a page never waits for a rewrite when an older brief exists.
  if (running) return prev ? { text: prev.text, at: prev.at } : running;
  const job = (async () => {
    const facts = items.map((i) => `- ${i.kind}: ${i.text}. ${i.detail}`).join('\n');
    const text = `You write the one-paragraph brief on ${subject} for a crypto intelligence terminal. In at most three short sentences (under 70 words total), say what matters most right now and how the signals relate. Use only these facts and their exact numbers; no advice, no hedging boilerplate, no headings or lists.\n\n${facts}`;
    let answer = '';
    try {
      for await (const e of streamNansen('agent/fast', { text }, { record: false })) {
        if (e.type === 'delta') answer += e.text;
        else if (e.type === 'error') { console.error(`brief ${key}:`, e); return prev; }
      }
    } catch (err) { console.error(`brief ${key}:`, err); return prev; }
    const clean = answer.replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
    if (!clean) return prev;
    const brief = { text: clean, at: Date.now(), sig };
    setKv(kvKey(key), JSON.stringify(brief));
    return { text: brief.text, at: brief.at };
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return prev ? { text: prev.text, at: prev.at } : job;
}

export const pulseBrief = (items: PulseItem[]) => aiBrief('pulse', items);
