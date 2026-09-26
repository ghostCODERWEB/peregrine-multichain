// The Market Pulse AI brief: Nansen's agent (agent/fast) summarizes the
// derived pulse in three short sentences. One brief is shared by every view:
// cached in kv, regenerated at most hourly and only when the data changed.
import { createHash } from 'node:crypto';
import { streamNansen } from '@/server/nansen/client';
import { getKv, setKv } from '@/server/nansen/db';
import type { PulseItem } from '@/server/pulse';

const KEY = 'pulse:brief', TTL = 3_600_000;
export interface PulseBrief { text: string; at: number }
let inflight: Promise<PulseBrief | null> | null = null;

export function cachedBrief(): PulseBrief | null {
  const v = getKv(KEY);
  try { return v ? (JSON.parse(v.value) as PulseBrief & { sig: string }) : null; } catch { return null; }
}

export async function pulseBrief(items: PulseItem[]): Promise<PulseBrief | null> {
  const sig = createHash('sha1').update(items.map((i) => i.text).join('|')).digest('hex');
  const cur = getKv(KEY);
  const prev = cur ? (JSON.parse(cur.value) as PulseBrief & { sig: string }) : null;
  if (prev && (prev.sig === sig || Date.now() - prev.at < TTL)) return prev;
  if (!items.length) return prev;
  inflight ??= (async () => {
    const facts = items.map((i) => `- ${i.kind}: ${i.text}. ${i.detail}`).join('\n');
    const text = `You write the one-paragraph market pulse for a crypto intelligence terminal. In at most three short sentences (under 70 words total), say what matters most right now and how the signals relate. Use only these facts and their exact numbers; no advice, no hedging boilerplate, no headings or lists.\n\n${facts}`;
    let answer = '';
    try {
      for await (const e of streamNansen('agent/fast', { text }, { record: false })) {
        if (e.type === 'delta') answer += e.text;
        else if (e.type === 'error') { console.error('pulse brief:', e); return prev; }
      }
    } catch (err) { console.error('pulse brief:', err); return prev; }
    const clean = answer.replace(/\*\*/g, '').trim();
    if (!clean) return prev;
    const brief = { text: clean, at: Date.now(), sig };
    setKv(KEY, JSON.stringify(brief));
    return brief;
  })().finally(() => { inflight = null; });
  return inflight;
}
