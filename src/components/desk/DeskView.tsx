'use client';
// The Desk (L1): every call this desk made, open or graded, with the receipts
// behind entry and grade, and "Trader DNA": hit rate by setup and horizon.
import Link from 'next/link';
import { ChainLogo, TokenLogo } from '@/components/Logo';
import { useEffect, useState } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName } from '@/lib/viz/format';
import { setupLabel, type DnaRow, type Grade } from '@/lib/models/calls';
import type { CallCardWithNotes } from '@/server/desk/calls';
import { receiptProvenance, fmtPrice, GRADE_RULES } from './receipt';
import { AskNansen } from '@/components/agent/AskNansen';
import { Go } from '@/components/ui/Icons';

export interface DeskData {
  scope: string | null;
  calls: CallCardWithNotes[];
  dna: { bySetup: DnaRow[]; byHorizon: DnaRow[]; bySource: DnaRow[] };
}

const pctS = (x: number | null) => (x == null ? 'n/a' : `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(2)}%`);
const utc = (ms: number) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const GRADE: Record<Grade, { label: string; dot: string }> = {
  won: { label: 'won', dot: 'var(--in-2)' },
  lost: { label: 'lost', dot: 'var(--out-2)' },
  'too-early': { label: 'too early', dot: 'var(--axis)' },
  invalidated: { label: 'invalidated', dot: 'var(--storm-3, var(--out-3))' },
};
const due = (c: CallCardWithNotes, now: number) => c.grade == null && c.source === 'live' && c.dueAt + 10 * 60_000 <= now;

function left(ms: number) {
  if (ms <= 0) return 'due now';
  const h = Math.floor(ms / 3_600_000),
    m = Math.floor((ms % 3_600_000) / 60_000);
  return h >= 24 ? `due in ${Math.floor(h / 24)}d ${h % 24}h` : h ? `due in ${h}h ${m}m` : `due in ${m}m`;
}

function CallRow({ c, now, onNoteAttached }: { c: CallCardWithNotes; now: number | null; onNoteAttached: () => void }) {
  const name = c.symbol ?? `${c.token.slice(0, 6)}…`;
  return (
    <li className="space-y-1 border-t border-border py-3 first:border-0 text-[13px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-ink">
          <b className="uppercase">{c.stance}</b>{' '}
          <Link
            href={`/token/${c.chain}/${encodeURIComponent(c.token)}`}
            className="inline-flex items-center gap-1.5 align-middle underline-offset-2 hover:underline"
          >
            <TokenLogo symbol={c.symbol} logo={c.logo} chain={c.chain} address={c.token} size={16} />
            {name}
          </Link>
          <span className="text-ink-muted">
            {' '}
            · <ChainLogo chain={c.chain} size={12} /> {chainName(c.chain)} · {c.horizon} · {setupLabel(c.setup)}
            {c.source === 'replay' ? ' · Time Machine' : ''}
          </span>
        </span>
        <span className="flex items-center gap-2">
          {c.grade ? (
            <span className="flex items-center gap-1.5 text-ink">
              <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: GRADE[c.grade].dot }} />
              {GRADE[c.grade].label} <span className="num text-ink-2">{pctS(c.ret)}</span>
            </span>
          ) : (
            <span className="text-ink-2">{now == null ? `due ${utc(c.dueAt)}` : left(c.dueAt - now)}</span>
          )}
          <AskNansen
            subject={{ kind: 'token', chain: c.chain, address: c.token }}
            label={`${name} on ${chainName(c.chain)}`}
            attachTo={{ callId: c.id, onAttached: onNoteAttached }}
            buttonClassName="text-[11px] text-ink-muted hover:text-ink"
          />
        </span>
      </div>
      <div className="num flex flex-wrap items-center gap-x-3 text-[12px] text-ink-2">
        <span>
          entry {fmtPrice(c.entry)} <InfoPopover p={receiptProvenance('Entry price', c.entryReceipt, [`Called ${utc(c.createdAt)}.`])} />
        </span>
        {c.invalidation != null && <span>invalidation {fmtPrice(c.invalidation)}</span>}
        {c.grade && c.gradeReceipt && (
          <span>
            exit {fmtPrice(c.exit)} <InfoPopover p={receiptProvenance('Grade', c.gradeReceipt, [GRADE_RULES])} />
          </span>
        )}
        {c.gradeDetail && c.stance !== 'pass' && (
          <span>
            best {pctS(c.gradeDetail.best)} · worst {pctS(c.gradeDetail.worst)} your way
          </span>
        )}
        {c.context?.storm && (
          <span>
            at the call: Storm {c.context.storm.score} {c.context.storm.band}
          </span>
        )}
        {c.context?.replayAt != null && <span>replayed cutoff {utc(c.context.replayAt)}</span>}
        {c.context?.chainCpi != null && (
          <span>
            {chainName(c.chain)} Flow Index {c.context.chainCpi}
          </span>
        )}
        {c.context?.gauges && c.context.gauges.direction != null && (
          <span>
            gauges then: direction {c.context.gauges.direction > 0 ? '+' : c.context.gauges.direction < 0 ? '−' : ''}
            {Math.abs(c.context.gauges.direction)} · confidence {c.context.gauges.confidence ?? 'n/a'} · coordination{' '}
            {c.context.gauges.coordination ?? 'n/a'}
          </span>
        )}
      </div>
      {c.thesis && <p className="text-ink-2">“{c.thesis}”</p>}
      {!c.grade && c.gradeNote && <p className="text-[11.5px] text-ink-muted">{c.gradeNote}</p>}
      {c.notes.length > 0 && (
        <ul className="mt-1 space-y-0.5 border-l-2 border-border pl-2">
          {c.notes.map((n) => (
            <li key={n.id} className="text-[11.5px] text-ink-muted">
              Ask Nansen note ({utc(n.createdAt)}): “{n.question}”
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Dna({ title, rows }: { title: string; rows: DnaRow[] }) {
  if (!rows.length) return null;
  return (
    <div tabIndex={0} role="region" aria-label="Calls table" className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-[10.5px] uppercase tracking-wider text-ink-muted">
            <th className="py-1.5 font-normal">{title}</th>
            <th className="font-normal">Graded</th>
            <th className="font-normal">Won</th>
            <th className="font-normal">Lost</th>
            <th className="font-normal">Too early</th>
            <th className="font-normal">Invalidated</th>
            <th className="font-normal">Hit rate</th>
            <th className="font-normal">Avg move your way</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="num border-b border-border/60 text-ink-2">
              <th className="py-1.5 font-medium text-ink">{setupLabel(r.key)}</th>
              <td>{r.n}</td>
              <td>{r.won}</td>
              <td>{r.lost}</td>
              <td>{r.tooEarly}</td>
              <td>{r.invalidated}</td>
              <td className="text-ink">{r.hitRate == null ? 'n/a' : `${Math.round(r.hitRate * 100)}%`}</td>
              <td>{pctS(r.avgMove)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DeskView({ initial }: { initial: DeskData }) {
  const [data, setData] = useState(initial);
  const [now, setNow] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const refresh = () => {
    fetch('/api/desk', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  };

  useEffect(() => {
    const t = Date.now();
    setNow(t);
    if (!initial.calls.some((c) => due(c, t))) return;
    setStatus('Grading due calls from Nansen candles…');
    (async () => {
      try {
        const r = await fetch('/api/desk', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'grade' }),
        });
        const g = await r.json();
        if (!r.ok) throw new Error(g.error ?? 'Grading failed.');
        setData(await (await fetch('/api/desk', { cache: 'no-store' })).json());
        setStatus(
          g.pending ? `${g.graded} graded; ${g.pending} still waiting for Nansen candles.` : g.graded ? `${g.graded} graded.` : null,
        );
      } catch (e) {
        setStatus((e as Error).message);
      }
    })();
  }, [initial]);

  const open = data.calls.filter((c) => !c.grade),
    graded = data.calls.filter((c) => c.grade);
  const card = 'material p-5 sm:p-6';
  if (!data.calls.length) {
    return (
      <section className={card}>
        <h2 className="text-[15px] font-semibold text-ink">No calls yet</h2>
        <p className="mt-2 text-[13px] text-ink-2">
          Open any token and use <b>Make a call</b>.
        </p>
        <Link href="/alpha" className="mt-3 inline-block text-[13px] text-ink underline underline-offset-2">
          Find a token on the Alpha board <Go />
        </Link>
      </section>
    );
  }
  return (
    <div className="space-y-4">
      {status && (
        <p role="status" className="text-[12.5px] text-ink-2">
          {status}
        </p>
      )}
      <section className={card} aria-labelledby="dna">
        <h2 id="dna" className="text-[15px] font-semibold text-ink">
          Trader DNA: {graded.length ? `${graded.length} graded call${graded.length === 1 ? '' : 's'}` : 'nothing graded yet'}
        </h2>
        <p className="mt-1 text-[12px] text-ink-muted">
          Hit rate counts decisive outcomes only (won ÷ won + lost + invalidated). Fewer than 10 is an anecdote, not a record.
        </p>
        {graded.length > 0 && (
          <div className="mt-3 space-y-4">
            <Dna title="Setup" rows={data.dna.bySetup} />
            <Dna title="Horizon" rows={data.dna.byHorizon} />
            <Dna title="Source" rows={data.dna.bySource} />
          </div>
        )}
      </section>
      <section className={card} aria-labelledby="open-calls">
        <h2 id="open-calls" className="text-[15px] font-semibold text-ink">
          Open calls ({open.length})
        </h2>
        {open.length ? (
          <ul className="mt-2">
            {open.map((c) => (
              <CallRow key={c.id} c={c} now={now} onNoteAttached={refresh} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-ink-2">None open.</p>
        )}
      </section>
      <section className={card} aria-labelledby="graded-calls">
        <h2 id="graded-calls" className="text-[15px] font-semibold text-ink">
          Graded ({graded.length})
        </h2>
        {graded.length ? (
          <ul className="mt-2">
            {graded.map((c) => (
              <CallRow key={c.id} c={c} now={now} onNoteAttached={refresh} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] text-ink-2">Calls are graded once their horizon passes.</p>
        )}
        <p className="mt-3 border-t border-border pt-2 text-[11.5px] text-ink-muted">
          {GRADE_RULES} Calls can’t be edited or deleted.
        </p>
      </section>
    </div>
  );
}
