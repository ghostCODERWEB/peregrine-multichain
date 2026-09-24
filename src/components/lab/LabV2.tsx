'use client';
import { useState } from 'react';
import { Card, Unavailable } from '@/components/Card';
import { num, pct, chainName } from '@/lib/viz/format';
import type { V2Report } from '@/server/backtest/storm-v2';
import type { ForwardCheck, RuleResult } from '@/server/backtest/forward';

const signed = (v: number | null, d = 2) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(d)}%`);

export function StormV2Section({ r }: { r: V2Report | null }) {
  if (!r) return <Unavailable text="No Storm v2 run yet. `pnpm storm-v2` runs a small pilot within its credit cap." />;
  const inputs: Array<[keyof V2Report['coverage'], string]> = [['concentration', 'C concentration'], ['windShear', 'W wind shear'], ['sellPressure', 'P sell pressure'], ['nansenRisk', 'R Nansen risk'], ['exitLiquidity', 'L exit liquidity'], ['label', 'forward drawdown']];
  const n = r.observations.length;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Card id="v2-pilot" className="lg:col-span-3" title={`Storm rebuilt point in time: ${n} pilot observations, ${r.creditsNominal} credits against an empty cache`}
        sub="The live formulas applied to Nansen's historical endpoints as of each date, then the next 7 days of price. Insider clusters can't be rebuilt at a past date, so that input is dropped.">
        <div className="flex flex-wrap gap-1.5">
          {inputs.map(([k, label]) => <span key={k} className="num rounded-full border border-border px-2 py-0.5 text-[11.5px] text-ink-2">{label} {r.coverage[k]}/{n}</span>)}
          <span className="num rounded-full border border-dashed border-border px-2 py-0.5 text-[11.5px] text-ink-muted">I insider 0/{n}</span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-1.5 font-normal">Token</th><th className="font-normal">As of</th><th className="font-normal">C</th><th className="font-normal">W</th><th className="font-normal">L</th><th className="font-normal">P</th><th className="font-normal">R</th><th className="font-normal">Storm</th><th className="text-right font-normal">Worst 7 days</th></tr></thead>
            <tbody>{r.observations.map((o) => (
              <tr key={o.token + o.asOf} className="border-t border-border">
                <td className="py-1.5 text-ink">{o.symbol} <span className="text-ink-muted">{chainName(o.chain)}</span></td>
                <td className="num text-ink-2">{o.asOf}</td>
                {(['concentration', 'windShear', 'exitLiquidity', 'sellPressure', 'nansenRisk'] as const).map((k) => <td key={k} className="num text-ink-2">{o.subScores[k] == null ? '—' : num(o.subScores[k], 0)}</td>)}
                <td className="num text-ink">{Number.isFinite(o.storm) ? num(o.storm, 0) : '—'}</td>
                <td className="num text-right text-ink">{o.maxDrawdown7d == null ? '—' : `−${(o.maxDrawdown7d * 100).toFixed(1)}%`}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] text-ink-muted">{r.perObservationCredits} credits an observation: holders 25, quant scores 25, flow summary 5, who bought and sold 5, candles 5; the screener read is shared per chain and date. Nansen scored risk indicators for {r.coverage.nansenRisk} of {n}; the rest were empty, not errors.</p>
      </Card>
      <Card id="v2-power" className="lg:col-span-2" title="Why the weights stay expert priors" sub="How many observations a fit needs before its AUC could clear 0.70 with a 95% lower bound above 0.60 (Hanley–McNeil).">
        <table className="w-full text-left text-[12.5px]">
          <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-1.5 font-normal">Event</th><th className="font-normal">Base rate</th><th className="font-normal">Needs</th><th className="text-right font-normal">Credits</th></tr></thead>
          <tbody>{r.power.map((p) => (
            <tr key={p.event} className="border-t border-border align-top">
              <td className="py-1.5 pr-2 text-ink">{p.event}</td>
              <td className="num text-ink-2">{pct(p.baseRate, 1)}</td>
              <td className="num text-ink-2">{p.needed ? `${p.needed.n.toLocaleString('en-US')} obs · ${p.needed.events} events` : '—'}</td>
              <td className="num text-right text-ink">{p.credits?.toLocaleString('en-US') ?? '—'}</td>
            </tr>
          ))}</tbody>
        </table>
        <p className="mt-3 text-[12.5px] text-ink-2">{r.decision}</p>
        <p className="mt-2 text-[11.5px] text-ink-muted">The pipeline is built and priced: a full run is <code className="num">pnpm storm-v2 &lt;cap&gt;</code> with a cap that size, which needs the owner&apos;s go-ahead.</p>
      </Card>
    </div>
  );
}

function ForwardTable({ f }: { f: ForwardCheck }) {
  const early = f.moments < 24;
  return (
    <div>
      <table className="w-full text-left text-[12.5px]">
        <thead className="text-[11px] uppercase tracking-wider text-ink-muted"><tr><th className="py-1.5 font-normal">Reading</th><th className="font-normal">n</th><th className="font-normal">Rose</th><th className="font-normal">Mean</th><th className="text-right font-normal">Median</th></tr></thead>
        <tbody>{[...f.bands, f.baseline].map((b, i) => (
          <tr key={b.label} className={`border-t border-border ${i === f.bands.length ? 'text-ink-muted' : ''}`}>
            <td className="py-1.5 text-ink">{b.label}</td><td className="num">{b.n}</td><td className="num">{b.hitRate == null ? '—' : pct(b.hitRate, 0)}</td><td className="num">{signed(b.meanReturn)}</td><td className="num text-right">{signed(b.medianReturn)}</td>
          </tr>
        ))}</tbody>
      </table>
      <p className="mt-2 text-[11.5px] text-ink-muted">
        {f.readyAt ? `First result once history covers the horizon: after ${new Date(f.readyAt).toISOString().slice(0, 16).replace('T', ' ')} UTC. ` : ''}
        {f.pairs ? `${f.moments} rebuilt moments, ${f.pairs} readings; rank correlation ${f.spearman == null ? '—' : num(f.spearman, 2)}. ` : ''}
        {early && f.pairs ? 'Too early to read: a day of moments at least before any conclusion. ' : ''}{f.note}
      </p>
    </div>
  );
}

export function ForwardSection({ alpha, ppi }: { alpha: ForwardCheck; ppi: ForwardCheck }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card id="fwd-alpha" title={`Alpha, ${alpha.horizonHours} hours later`} sub="Each past board rebuilt from the snapshots it could have seen, then the price move that followed. Out of sample by construction.">
        <ForwardTable f={alpha} />
      </Card>
      <Card id="fwd-ppi" title={`Perp pressure, ${ppi.horizonHours} hours later`} sub="Each coin's Perp Pressure Index at a past hourly snapshot, then its mark price the horizon later.">
        <ForwardTable f={ppi} />
      </Card>
    </div>
  );
}

export function StrategyLab({ chains }: { chains: string[] }) {
  const [min, setMin] = useState('70');
  const [max, setMax] = useState('100');
  const [chain, setChain] = useState('');
  const [horizon, setHorizon] = useState(6);
  const [res, setRes] = useState<RuleResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setErr(null);
    const r = await fetch('/api/lab/rule', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ minScore: Number(min), maxScore: Number(max), chain: chain || null, horizonHours: horizon }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) setErr(j.error ?? 'Failed.'); else setRes(j);
  }
  const m = res?.matched;
  return (
    <Card id="strategy" title="Strategy lab: test a rule on TIDE's own history" sub="Pick alpha scores to act on and a horizon; see how those picks did afterwards, against every token the board showed at the same moments. Free: no Nansen call.">
      <div className="flex flex-wrap items-end gap-3 text-[12.5px]">
        <label className="text-ink-2">Alpha from<input id="rule-min" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} className="num mt-1 block w-20 rounded-lg border border-border bg-raised px-2 py-1 text-ink" /></label>
        <label className="text-ink-2">to<input id="rule-max" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} className="num mt-1 block w-20 rounded-lg border border-border bg-raised px-2 py-1 text-ink" /></label>
        <label className="text-ink-2">Chain<select id="rule-chain" value={chain} onChange={(e) => setChain(e.target.value)} className="mt-1 block rounded-lg border border-border bg-raised px-2 py-1 text-ink"><option value="">Any</option>{chains.map((c) => <option key={c} value={c}>{chainName(c)}</option>)}</select></label>
        <label className="text-ink-2">Horizon<select id="rule-h" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="mt-1 block rounded-lg border border-border bg-raised px-2 py-1 text-ink">{[3, 6, 12, 24].map((h) => <option key={h} value={h}>{h} hours</option>)}</select></label>
        <button onClick={run} className="rounded-full bg-brand/15 px-3.5 py-1.5 text-ink ring-1 ring-brand/40 hover:bg-brand/25">Test the rule</button>
      </div>
      {err && <p className="mt-2 text-[12.5px] text-ink">{err}</p>}
      {res && (
        <div className="mt-3 rounded-xl border border-border/70 bg-raised/50 p-3 text-[12.5px]">
          <div className="font-medium text-ink">{res.rule}, {res.horizonHours} hours later</div>
          {m ? <div className="num mt-1 text-ink-2">{m.baseline.n} picks · rose {m.baseline.hitRate == null ? '—' : pct(m.baseline.hitRate, 0)} · mean {signed(m.baseline.meanReturn)} · median {signed(m.baseline.medianReturn)}</div> : null}
          <div className="mt-1 text-ink-muted">{res.note} Past moves say little about the next ones; not financial advice.</div>
        </div>
      )}
    </Card>
  );
}
