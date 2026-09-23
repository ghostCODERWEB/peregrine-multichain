'use client';
import Link from 'next/link';
import { InfoPopover } from '@/components/InfoPopover';
import { chainName, num, pct } from '@/lib/viz/format';
import type { ForecastWave, Odds } from '@/server/token/forecast';

export function oddsTitle(f: ForecastWave): string {
  const s = f.storm.p, b = f.breakout.p;
  const vs = (p: number, base: number) => (p > base * 1.5 ? 'above' : p < base / 1.5 ? 'below' : 'near');
  return `7-day odds: ${pct(s, s < 0.1 ? 1 : 0)} storm, ${pct(b, b < 0.1 ? 1 : 0)} breakout — storm risk ${vs(s, f.storm.baseRate)} the base rate`;
}

/** "About 2 in 100": probabilities read as frequencies, never as calls. */
const inHundred = (p: number) => (p < 0.01 ? 'under 1 in 100' : `about ${Math.round(p * 100)} in 100`);

function Row({ label, o, tone }: { label: string; o: Odds; tone: string }) {
  // Scale: 0 to max(40%, 1.5× the larger of p and base rate), so small
  // probabilities are still visible next to their base-rate tick.
  const max = Math.max(0.4, o.p * 1.5, o.baseRate * 1.5);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] text-ink">{label}</span>
        <span className="num text-[18px] font-semibold text-ink">{pct(o.p, o.p < 0.1 ? 1 : 0)}</span>
      </div>
      <div className="relative mt-1 h-2.5 rounded-full bg-accent" aria-hidden>
        <div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, (o.p / max) * 100)}%`, background: tone }} />
        <div className="absolute -top-1 h-4.5 w-px bg-ink-2" style={{ left: `${(o.baseRate / max) * 100}%` }} title="base rate" />
      </div>
      <p className="mt-1 text-[11.5px] text-ink-2">
        {inHundred(o.p)} tokens like this one did it within 7 days; base rate {pct(o.baseRate, 1)} (tick).
      </p>
      <p className="num mt-0.5 text-[11px] text-ink-muted">
        track record: AUC {num(o.auc, 2)}{o.aucCi ? ` [${num(o.aucCi[0], 2)}–${num(o.aucCi[1], 2)}]` : ''} · {o.testN} tokens, {o.testEvents} events · tested {o.testAnchor}
      </p>
    </div>
  );
}

export function OddsCard({ f }: { f: ForecastWave }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><InfoPopover p={f.provenance} /></div>
      <Row label="Storm: falls 50%+ from here" o={f.storm} tone="var(--storm-3)" />
      <Row label="Breakout: rises 30%+ from here" o={f.breakout} tone="var(--in-3)" />
      <p className="text-[11.5px] text-ink-muted">
        {f.extrapolated ? `Trained on ${f.trainedOn.map(chainName).join(', ')} — on this chain the model is extrapolating. ` : ''}
        Probabilities from logistic models fitted on Nansen point-in-time data. <Link href="/lab" className="underline underline-offset-2 hover:text-ink">How they were tested →</Link> Not financial advice.
      </p>
    </div>
  );
}
