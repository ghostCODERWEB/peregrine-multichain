// POST /api/research {mode, target, question} → a server-sent event stream:
// target → step (running/done) → evidence → delta (answer text) → done (saved report). Owner view only.
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { displayMode } from '@/server/mode';
import { resolveTarget, planFor, prompt, saveReport, listReports, type Mode, type EvidenceItem } from '@/server/research/desk';
import { streamNansen } from '@/server/nansen/client';
import { allow, clientId } from '@/server/rate';

export const dynamic = 'force-dynamic';
const MODES: Mode[] = ['token', 'wallet', 'leaders', 'market'];

export async function GET() {
  if ((await displayMode()) !== 'owner') return NextResponse.json({ reports: [] });
  return NextResponse.json({ reports: listReports() });
}

export async function POST(req: Request) {
  if ((await displayMode()) !== 'owner') return NextResponse.json({ error: 'Research Desk runs on the owner view.' }, { status: 403 });
  if (!allow('research', clientId(req), 20)) return NextResponse.json({ error: 'Too many research runs; wait a minute.' }, { status: 429 });
  const body = (await req.json().catch(() => ({}))) as { mode?: string; target?: string; question?: string };
  const mode = (MODES.includes(body.mode as Mode) ? body.mode : 'token') as Mode;
  const question = (body.question ?? '').slice(0, 300);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctl) {
      const send = (event: string, data: unknown) => ctl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        send('step', { id: 'resolve', label: 'Resolving the target', status: 'running' });
        const t = await resolveTarget(body.target ?? '', mode);
        if ('error' in t) { send('step', { id: 'resolve', label: 'Resolving the target', status: 'failed', note: t.error }); send('error', { message: t.error }); ctl.close(); return; }
        const label = t.kind === 'token' ? `${t.symbol ?? t.address.slice(0, 8)} on ${t.chain}` : t.kind === 'wallet' ? t.name : 'The market';
        send('target', { ...t, label });
        send('step', { id: 'resolve', label: `Resolved: ${label}`, status: 'done' });

        const evidence: EvidenceItem[] = [];
        for (const step of planFor(t, mode)) {
          send('step', { id: step.id, label: step.label, status: 'running' });
          let items: EvidenceItem[] = [];
          try { items = await step.run(); } catch (e) { send('step', { id: step.id, label: step.label, status: 'failed', note: (e as Error).message.slice(0, 120) }); continue; }
          for (const it of items) { it.id = `E${evidence.length + 1}`; evidence.push(it); }
          send('evidence', items);
          send('step', { id: step.id, label: step.label, status: 'done', count: items.length });
          await new Promise((r) => setTimeout(r, 120)); // pace the timeline so each step reads
        }

        send('step', { id: 'write', label: 'Nansen AI writes a cited report', status: 'running' });
        let answer = '';
        for await (const e of streamNansen('agent/fast', { text: prompt(t, mode, question, evidence) }, { record: false })) {
          if (e.type === 'delta') { answer += e.text; send('delta', { text: e.text }); }
          else if (e.type === 'error') throw new Error(e.error || 'Nansen agent error');
        }
        answer = answer.replace(/\*\*/g, '').trim();
        send('step', { id: 'write', label: 'Nansen AI writes a cited report', status: 'done' });
        const report = { id: randomUUID(), at: Date.now(), mode, target: label, question, evidence, answer };
        saveReport(report);
        send('done', report);
      } catch (e) {
        send('error', { message: (e as Error).message.slice(0, 200) });
      }
      ctl.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive' } });
}
