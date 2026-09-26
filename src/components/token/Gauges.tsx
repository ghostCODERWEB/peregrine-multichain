'use client';
// Three gauges and "What would break this?" (L2). Direction, confidence and
// coordination risk stay three readings with their own receipts; nothing on
// this card adds them up.
import type { ReactNode } from 'react';
import { InfoPopover } from '@/components/InfoPopover';
import type { Provenance } from '@/lib/provenance';
import { directionGauge, confidenceGauge, coordinationGauge, falsifiers, type Gauge, type GaugeInputs } from '@/lib/models/gauges';
import type { Ladder } from '@/lib/models/liquidation';

export interface GaugeSources { wind: Provenance | null; header: Provenance | null; forensics: Provenance | null; leverage: Provenance | null }
export interface GaugeReadings { direction: number | null; confidence: number | null; coordination: number | null }

export function gaugeReadings(i: GaugeInputs): GaugeReadings {
  return { direction: directionGauge(i).value, confidence: confidenceGauge(i).value, coordination: coordinationGauge(i).value };
}

export function gaugesTitle(i: GaugeInputs): string {
  const d = directionGauge(i), c = confidenceGauge(i), k = coordinationGauge(i);
  if (d.value == null) return 'Direction, confidence and coordination: waiting for Nansen flows';
  return `${d.label[0].toUpperCase()}${d.label.slice(1)}, ${c.label}, ${k.value == null ? 'coordination not read yet' : `${k.label} coordination risk`}`;
}

const pv = (title: string, formula: string, g: Gauge, src: Array<Provenance | null>, notes: string[] = []): Provenance => ({
  title, formula,
  inputs: g.parts.map((p) => ({ label: p.label, value: p.value == null ? 'missing' : Math.abs(p.value) >= 1000 ? `$${Math.round(p.value).toLocaleString('en-US')}` : p.value.toFixed(2) })).concat(g.parts.map((p) => ({ label: `· ${p.label}`, value: p.note }))),
  calls: src.flatMap((p) => p?.calls ?? []),
  notes,
});

function Meter({ value, diverging, color }: { value: number | null; diverging?: boolean; color: string }) {
  if (value == null) return <div className="h-2 rounded-full bg-raised" aria-hidden />;
  const w = Math.min(100, Math.abs(value));
  return (
    <div className="relative h-2 overflow-hidden rounded-full bg-raised" aria-hidden>
      {diverging ? <>
        <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--axis)]" />
        <span className="absolute inset-y-0 rounded-full" style={{ background: color, width: `${w / 2}%`, left: value >= 0 ? '50%' : `${50 - w / 2}%` }} />
      </> : <span className="absolute inset-y-0 left-0 rounded-full" style={{ background: color, width: `${w}%` }} />}
    </div>
  );
}

function GaugeBlock({ name, g, shown, color, diverging, info }: { name: string; g: Gauge; shown: string; color: string; diverging?: boolean; info: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5" role="group" aria-label={`${name}: ${shown}, ${g.label}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-muted">{name}</span>
        <span className="flex items-center gap-1"><span className="num text-[18px] font-semibold text-ink">{shown}</span>{info}</span>
      </div>
      <Meter value={g.value} diverging={diverging} color={color} />
      <div className="text-[12.5px] text-ink">{g.label}</div>
      <ul className="space-y-0.5 text-[11.5px] text-ink-2">{g.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul>
    </div>
  );
}

export function Gauges({ inputs, ladder, sources }: { inputs: GaugeInputs; ladder: Ladder | null; sources: GaugeSources }) {
  const d = directionGauge(inputs), c = confidenceGauge(inputs), k = coordinationGauge(inputs);
  const pick = (side: 'long' | 'short') => ladder?.bands.filter((b) => b.side === side && b.usd > 0).sort((a, b) => b.usd - a.usd)[0] ?? null;
  const lo = pick('long'), hi = pick('short');
  const fs = falsifiers(inputs, d, ladder ? { mark: ladder.mark, below: lo ? { price: lo.price, usd: lo.usd } : null, above: hi ? { price: hi.price, usd: hi.usd } : null } : null);
  const conflicts: string[] = [];
  if (d.value != null && Math.abs(d.value) >= 20 && c.value != null && c.value < 35) conflicts.push('A clear side on thin evidence: the direction may not hold.');
  if (d.value != null && d.value >= 20 && k.value != null && k.value >= 50) conflicts.push('The buying sits next to linked holders: some of it may be one party.');
  if (d.value != null && Math.abs(d.value) < 20 && c.value != null && c.value >= 65) conflicts.push('Plenty of evidence, no side: informed wallets are split.');
  const srcOf = { wind: sources.wind, leverage: sources.leverage, forensics: sources.forensics, header: sources.header };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <GaugeBlock name="Direction" g={d} shown={d.value == null ? 'n/a' : `${d.value > 0 ? '+' : d.value < 0 ? '−' : ''}${Math.abs(d.value)}`} color={d.value != null && d.value < 0 ? 'var(--out-2)' : 'var(--in-2)'} diverging
          info={<InfoPopover p={pv('Direction', 'direction = 100·tanh(informed 1d net flow ÷ (5% of liquidity)); −100 selling … +100 buying\ninformed = smart traders + top-PnL wallets + whales + public figures (tgm/flow-intelligence)', d, [sources.wind, sources.header], ['The all-trader DEX split is shown next to it, not mixed in.'])} />} />
        <GaugeBlock name="Confidence" g={c} shown={c.value == null ? 'n/a' : String(c.value)} color="var(--ink-2)"
          info={<InfoPopover p={pv('Confidence', 'confidence = 100 × mean(sample, agreement, depth, recency); a missing part counts as 0', c, [sources.wind, sources.header], ['Confidence is about the evidence, not about the price going anywhere.'])} />} />
        <GaugeBlock name="Coordination risk" g={k} shown={k.value == null ? 'n/a' : String(k.value)} color="var(--storm-3, var(--out-3))"
          info={<InfoPopover p={pv('Coordination risk', 'coordination = 100 × max(linked supply ÷ 20%, linked top holders ÷ compared)\nlinks: shared first funder or related wallets among the top 25 holders (profiler/address/*)', k, [sources.forensics], ['A shared funder can be an exchange or a faucet; links are evidence, not proof of one owner.'])} />} />
      </div>
      {conflicts.length > 0 && <ul className="space-y-1 rounded-lg border border-dashed border-border px-3 py-2 text-[12.5px] text-ink">{conflicts.map((x) => <li key={x}>{x}</li>)}</ul>}
      <div>
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">What would break this?</h3>
        {fs.length ? <ul className="mt-1.5 space-y-1.5 text-[13px] text-ink">{fs.map((f) => (
          <li key={f.text} className="flex items-start gap-1.5"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: f.active ? 'var(--storm-3, var(--out-3))' : 'var(--ink-2)' }} aria-hidden /><span className={`min-w-0 flex-1 ${f.active ? 'font-medium' : ''}`}>{f.text}</span>
            {srcOf[f.source] && <InfoPopover p={{ ...srcOf[f.source]!, title: `Source: ${srcOf[f.source]!.title}` }} />}</li>
        ))}</ul> : <p className="mt-1.5 text-[12.5px] text-ink-2">Not enough data yet to write a falsifier.</p>}
      </div>
      <p className="text-[11px] text-ink-muted">Three readings on purpose: none of them says buy or sell, and they are never added up.</p>
    </div>
  );
}
