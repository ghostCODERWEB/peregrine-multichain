'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { CircleCheck, TriangleAlert, CircleX, CircleHelp, Loader2 } from 'lucide-react';
import { ChainLogo, TokenLogo } from '@/components/Logo';
import { ScoreRing } from '@/components/viz/ScoreRing';
import { chainName, shortAddress, usd } from '@/lib/viz/format';
import type { RugReport, CheckStatus, Verdict } from '@/lib/rug';
import { Go } from '@/components/ui/Icons';

type TokenInfo = { name: string | null; symbol: string | null; logo: string | null; marketCapUsd: number | null; liquidityUsd: number | null; holders: number | null } | { unavailable: string };

const STATUS: Record<CheckStatus, { icon: typeof CircleCheck; color: string; word: string }> = {
  pass: { icon: CircleCheck, color: 'var(--mint)', word: 'Pass' },
  warn: { icon: TriangleAlert, color: 'var(--amber)', word: 'Caution' },
  fail: { icon: CircleX, color: 'var(--flare)', word: 'Fail' },
  unknown: { icon: CircleHelp, color: 'var(--ink-muted)', word: 'No data' },
};
const VERDICT: Record<Verdict, { word: string; color: string; line: string }> = {
  low: { word: 'Low', color: 'var(--mint)', line: 'No strong rug signals in Nansen’s data right now.' },
  moderate: { word: 'Moderate', color: 'var(--amber)', line: 'Some warning signs: size positions carefully.' },
  high: { word: 'High', color: 'var(--flare)', line: 'Several rug signals line up in Nansen’s data.' },
  critical: { word: 'Critical', color: 'var(--flare)', line: 'The Dump Risk model sees this token near its worst readings.' },
  unknown: { word: 'Unknown', color: 'var(--ink-muted)', line: 'Nansen returned too little data to grade this token.' },
  stablecoin: { word: 'Stablecoin', color: 'var(--signal)', line: 'Nansen classifies this token as a stablecoin; rug checks don’t apply.' },
};

export function RugReportView({ chain, address }: { chain: string; address: string }) {
  const [token, setToken] = useState<TokenInfo | null>(null);
  const [report, setReport] = useState<RugReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(null); setReport(null); setError(null);
    const es = new EventSource(`/api/rug/${chain}/${encodeURIComponent(address)}`);
    es.addEventListener('token', (e) => setToken(JSON.parse((e as MessageEvent).data)));
    es.addEventListener('report', (e) => setReport(JSON.parse((e as MessageEvent).data)));
    es.addEventListener('error', (e) => { const d = (e as MessageEvent).data; if (d) setError(JSON.parse(d).message); });
    es.addEventListener('done', () => es.close());
    es.onerror = () => { es.close(); setError((prev) => prev ?? 'The check was interrupted. Reload to try again.'); };
    return () => es.close();
  }, [chain, address]);

  const info = token && !('unavailable' in token) ? token : null;
  const v = report ? VERDICT[report.verdict] : null;
  const counts = report ? (['fail', 'warn', 'pass'] as const).map((s) => [s, report.checks.filter((c) => c.status === s).length] as const) : [];

  return (
    <div className="space-y-5">
      <section aria-labelledby="rug-verdict" className="material p-6 sm:p-8">
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="hero-seq min-w-0">
            <div className="flex items-center gap-3">
              <span className="relative"><TokenLogo symbol={info?.symbol ?? '?'} logo={info?.logo} chain={chain} address={address} size={52} /><span className="absolute -bottom-1 -right-1"><ChainLogo chain={chain} size={20} /></span></span>
              <div className="min-w-0">
                <div className="truncate text-[26px] font-extrabold tracking-[-0.03em]">{info?.name ?? info?.symbol ?? (token ? 'Unknown token' : 'Loading token…')}</div>
                <div className="num truncate text-[13px] text-ink-muted">{info?.symbol ?? 'n/a'} · {chainName(chain)} · {shortAddress(address)}</div>
              </div>
            </div>
            <h1 id="rug-verdict" className="mt-6 text-[clamp(30px,3vw,40px)] font-extrabold leading-[1.05] tracking-[-0.04em] text-balance">
              {v ? <>Rug risk: <span style={{ color: v.color }}>{v.word}</span></> : 'Checking…'}
            </h1>
            <p className="mt-2 max-w-xl text-[15px] text-ink-2">{v?.line ?? 'Reading liquidity, holders and who funded them from Nansen.'}</p>
            {report && (
              <div className="mt-4 flex flex-wrap gap-2">
                {counts.map(([s, n]) => n > 0 && (
                  <span key={s} className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold" style={{ color: STATUS[s].color, background: `color-mix(in srgb, ${STATUS[s].color} 14%, transparent)` }}>
                    {n} {STATUS[s].word.toLowerCase()}
                  </span>
                ))}
                {!report.final && <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ink/5 px-3 text-[12.5px] font-semibold text-ink-muted"><Loader2 size={13} className="animate-spin" aria-hidden />Tracing insider clusters…</span>}
              </div>
            )}
          </div>
          {report?.score != null && (
            <div className="justify-self-center text-center">
              <ScoreRing score={report.score} size={150} stroke={12} color={v!.color} label="Dump Risk" sublabel="Dump Risk" />
              <div className="mt-2 text-[12px] text-ink-muted">7-day model{report.confidence != null ? ` · confidence ${Math.round(report.confidence * 100)}%` : ''}</div>
            </div>
          )}
        </div>
      </section>

      {error && <p className="inset-well px-4 py-3 text-[13px] text-ink-2">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Checks">
        {(report?.checks ?? []).map((c) => {
          const S = STATUS[c.status], Icon = S.icon;
          return (
            <section key={c.id} aria-label={`${c.title}: ${S.word}`} className="material p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-ink-2">{c.title}</span>
                <span className="inline-flex items-center gap-1.5 text-[12.5px] font-extrabold" style={{ color: S.color }}><Icon size={16} aria-hidden />{S.word}</span>
              </div>
              <div className="num mt-2 text-[21px] font-extrabold tracking-[-0.02em] text-ink">{c.value}</div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{c.detail}</p>
            </section>
          );
        })}
        {!report && !error && Array.from({ length: 6 }, (_, i) => <div key={i} className="material h-[148px] animate-pulse" aria-hidden />)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-muted">
        <span></span>
        <span className="flex gap-4">
          <Link href="/rug" className="font-bold text-ink-2 hover:text-ink">Check another token</Link>
          <Link href={`/token/${chain}/${encodeURIComponent(address)}`} className="font-bold text-[var(--mint)]">Full token page <Go /></Link>
        </span>
      </div>
      {info && <p className="text-[12px] text-ink-muted">Market cap {usd(info.marketCapUsd)} · liquidity {usd(info.liquidityUsd)} · {info.holders != null ? `${info.holders.toLocaleString('en-US')} holders` : 'holders n/a'}</p>}
    </div>
  );
}
