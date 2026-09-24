'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, Unavailable, WaveLoading } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import type { Portfolio, PortfolioStress } from '@/server/portfolio/portfolio';
import type { Position } from '@/lib/models/portfolio';
import type { DeskData } from '@/server/wallet/desk';
import { chainName, pct, shortAddress, usd } from '@/lib/viz/format';

const DEMO = '0xcbb811f129782ef87e19dea9d3375045219bae00';
const button = 'rounded-lg border border-border px-3 py-2 text-sm text-ink hover:bg-accent disabled:opacity-50';

export function PortfolioView({ demo }: { demo: boolean }) {
  const [input, setInput] = useState(''), [canSave, setCanSave] = useState(false);
  const [p, setP] = useState<Portfolio | null>(null), [stress, setStress] = useState<PortfolioStress | null>(null);
  const [connections, setConnections] = useState<DeskData | null>(null);
  const [busy, setBusy] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState('');
  // The saved watch set fills the box only if the visitor has not already
  // typed or picked wallets: on a slow load the answer can arrive after
  // they have, and must not wipe their choice.
  useEffect(() => { let mounted = true; fetch('/api/portfolio').then((r) => r.json()).then((d) => { if (mounted) { setCanSave(d.canSave); setInput((cur) => cur.trim() ? cur : d.addresses.join('\n')); } }).catch(() => { if (mounted) setError('Saved wallets could not be loaded. You can still analyze addresses below.'); }); return () => { mounted = false; }; }, []);
  async function run(action: 'analyze' | 'stress' | 'save' | 'counterparties') {
    setBusy(action); setError(''); setMessage('');
    if (action === 'analyze') { setP(null); setStress(null); setConnections(null); }
    if (action === 'stress') setStress(null);
    try {
      const addresses = input.split(/[\s,]+/).filter(Boolean);
      const r = await fetch('/api/portfolio', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, addresses }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'The portfolio request failed.');
      if (action === 'analyze') setP(data);
      else if (action === 'stress') setStress(data);
      else if (action === 'counterparties') setConnections(data);
      else setMessage('Watch set saved to your account.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  }
  return <div className="space-y-5">
    <div className="rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-accent p-6 sm:p-8"><p className="text-xs uppercase tracking-[0.2em] text-ink-muted">Portfolio observatory</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">See where your capital gathers.</h1><p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">Bring up to five wallets into one view. Explore concentration across chains, inspect every position, and test how the covered holdings respond to a seven-day price shock.</p></div>
    <Card id="watchset" title="Your wallet watch set" sub="One address per line. EVM addresses are deduplicated regardless of case; Solana and other case-sensitive addresses keep their identity.">
      <label htmlFor="portfolio-addresses" className="mb-2 block text-xs text-ink-2">Wallet addresses</label>
      <textarea id="portfolio-addresses" rows={3} value={input} disabled={!!busy} onChange={(e) => { setInput(e.target.value); setP(null); setStress(null); setMessage(''); setError(''); }} placeholder="0x… or a Solana, Bitcoin, Sui, TON, NEAR… wallet" className="num w-full rounded-lg border border-border bg-background p-3 text-xs" />
      <div className="mt-3 flex flex-wrap gap-2"><button className={`${button} bg-accent`} disabled={!!busy || !input.trim()} onClick={() => run('analyze')}>Analyze · up to 5 credits</button><button className={button} disabled={!!busy || !canSave} onClick={() => run('save')}>Save watch set</button>{demo && <button className={button} disabled={!!busy} onClick={() => { setInput(DEMO); setP(null); setStress(null); }}>Use recorded demo wallet</button>}</div>
      {!canSave && <p className="mt-2 text-xs text-ink-muted">Sign in to save a private watch set. Analysis does not require a wallet connection.</p>}
      <p className="mt-2 text-xs text-ink-muted">Prices are maximum uncached API credits; cached responses and demo replay use zero.</p>
      <div aria-live="polite" className="mt-3">{error && <Unavailable text={error} />}{message && <p className="text-sm">{message}</p>}{busy === 'analyze' && <WaveLoading what="portfolio balances" height={140} />}</div>
    </Card>
    {p && <>
      <div className="grid gap-3 sm:grid-cols-3">{[['Priced spot holdings', usd(p.exposure.total)], ['Largest position', p.exposure.largestShare == null ? '—' : pct(p.exposure.largestShare)], ['Effective positions', p.exposure.effectivePositions?.toFixed(1) ?? '—']].map(([label, value]) => <div key={label} className="glass rounded-2xl p-5"><div className="text-xs text-ink-muted">{label}</div><div className="num mt-2 text-3xl">{value}</div></div>)}</div>
      <Card id="portfolio-allocation" title={`${p.exposure.byChain.length} chains · ${p.positions.length} priced positions`} sub="Each area is proportional to its USD value. Open a block to inspect the token; the table includes every position." action={<InfoPopover p={p.provenance} />}>
        {p.positions.length ? <><AllocationMap positions={p.positions} /><div className="mt-5 max-h-96 overflow-auto"><table className="w-full text-left text-xs"><thead><tr className="text-ink-muted"><th className="p-2">Token</th><th className="p-2">Chain</th><th className="p-2 text-right">Value</th><th className="p-2 text-right">Share</th><th className="p-2 text-right">Wallets</th></tr></thead><tbody>{p.positions.map((x) => <tr key={`${x.chain}:${x.tokenAddress}`} className="border-t border-border/50"><td className="p-2"><Link className="hover:underline" href={`/token/${x.chain}/${encodeURIComponent(x.tokenAddress)}`}>{x.symbol}</Link></td><td className="p-2">{chainName(x.chain)}</td><td className="num p-2 text-right">{usd(x.valueUsd)}</td><td className="num p-2 text-right">{pct(x.valueUsd / p.exposure.total)}</td><td className="num p-2 text-right">{x.wallets.length}</td></tr>)}</tbody></table></div></> : <Unavailable text="No priced spot positions were available. Check each wallet's result below." />}
        <p className="mt-3 text-xs text-ink-muted">Spot balances only. Unpriced assets, DeFi receipt-token overlap and derivative collateral are excluded from this analysis.</p>
      </Card>
      <Card id="portfolio-wallets" title="Wallet coverage"><ul className="space-y-2">{p.wallets.map((w) => <li key={w.address} className="rounded-lg bg-accent/30 p-3 text-xs"><Link href={`/wallet/${encodeURIComponent(w.address)}`} className="num hover:underline">{shortAddress(w.address)} →</Link><span className="ml-3">{w.totalUsd == null ? 'Unavailable' : usd(w.totalUsd)}</span>{w.error && <p className="mt-1 text-ink-muted">{w.error}</p>}{w.limited && <p className="mt-1 text-ink-muted">Only the largest 200 positions are included.</p>}</li>)}</ul><p className="num mt-3 text-xs text-ink-muted">{p.tally.calls} Nansen calls · {p.tally.credits} credits · {p.tally.cached} cached</p></Card>
      <Card id="portfolio-storm" title="How much of the portfolio has a Storm reading?" sub="Value-weighted local readings from the last 24 hours. A heuristic risk indicator, not a forecast probability." action={<InfoPopover p={p.provenance} />}>
        <p className="num text-2xl">{p.storm.score == null ? 'No recent reading' : `${p.storm.score.toFixed(0)} / 100`}</p><p className="mt-2 text-sm text-ink-2">{usd(p.storm.coveredUsd)} of {usd(p.exposure.total)} covered. Positions without a reading remain unknown.</p>
        <ul className="mt-3 space-y-2">{p.storm.rows.map((s) => <li key={`${s.chain}:${s.tokenAddress}`} className="flex items-center gap-3 text-xs"><Link className="w-24 truncate hover:underline" href={`/token/${s.chain}/${encodeURIComponent(s.tokenAddress)}`}>{s.symbol}</Link><span className="h-2 flex-1 rounded bg-accent"><span className="block h-2 rounded bg-storm-3" style={{ width: `${s.score}%` }} /></span><span className="num">{s.score.toFixed(0)} · {usd(s.valueUsd)}</span></li>)}</ul>
      </Card>
      <Card id="portfolio-connections" title="Who connects these wallets?" sub="Inspect transfer counterparties across EVM or Solana wallets, with separate coverage for each ecosystem.">
        <button className={button} disabled={!!busy} onClick={() => run('counterparties')}>Load counterparties · estimated up to 25 credits</button>
        {busy === 'counterparties' && <WaveLoading what="counterparty connections" height={120} />}
        {connections && <div className="mt-4 space-y-3"><div className="flex justify-between"><p className="text-xs text-ink-2">{connections.description}</p><InfoPopover p={connections.provenance} /></div>{connections.tables.map((t) => <div key={t.title}><h3 className="text-sm">{t.title}</h3><div className="mt-2 max-h-80 overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{t.columns.map((c) => <th className="p-2 font-normal text-ink-muted" key={c}>{c}</th>)}</tr></thead><tbody>{t.rows.map((row, i) => <tr className="border-t border-border" key={i}>{row.map((v, j) => <td className="p-2" key={j}>{j < 2 && typeof v === 'string' ? <Link title={v} href={`/wallet/${encodeURIComponent(v)}`} className="num hover:underline">{shortAddress(v)}</Link> : v ?? '—'}</td>)}</tr>)}</tbody></table></div>{!t.rows.length && <Unavailable text="Nansen returned no counterparties for this request." />}</div>)}{connections.provenance.notes?.map((n) => <p key={n} className="text-xs text-ink-muted">{n}</p>)}</div>}
      </Card>
      <Card id="portfolio-stress" title="What if the largest positions move together?" sub="A seven-day sensitivity scenario for up to eight positions, using their own daily volatility and historical cone coverage.">
        <button className={button} disabled={!!busy || !p.positions.length} onClick={() => run('stress')}>Run stress scenario · up to 13 credits</button>
        {busy === 'stress' && <div className="mt-3"><WaveLoading what="daily candles and track records" height={120} /></div>}
        {stress && <div className="mt-4 space-y-4"><div className="flex items-start justify-between"><p className="text-sm">{pct(stress.summary.coverage)} of available spot value modeled. {usd(stress.summary.unmodeled)} remains unmodeled.</p><InfoPopover p={stress.provenance} /></div>{stress.failedWallets.length > 0 && <Unavailable text={`${stress.failedWallets.length} wallet(s) were unavailable. Coverage refers only to the wallets that returned balances.`} />}
          {stress.rows.length ? <><div className="grid grid-cols-3 gap-2 rounded-xl bg-accent/40 p-4">{[['Down scenario', stress.summary.low], ['Modeled value now', stress.summary.covered], ['Up scenario', stress.summary.high]].map(([label, value]) => <div key={String(label)}><p className="text-[11px] text-ink-muted">{label}</p><p className="num mt-1 text-lg sm:text-2xl">{usd(value as number)}</p></div>)}</div><div className="overflow-auto"><table className="w-full text-left text-xs"><thead><tr>{['Token', 'Down scenario', 'Now', 'Up scenario', 'Historical coverage', 'Test windows'].map((c) => <th key={c} className="p-2 font-normal text-ink-muted">{c}</th>)}</tr></thead><tbody>{stress.rows.map((r) => <tr className="border-t border-border" key={`${r.chain}:${r.tokenAddress}`}><td className="p-2">{r.symbol} · {chainName(r.chain)}</td><td className="num p-2">{usd(r.low)}</td><td className="num p-2">{usd(r.valueUsd)}</td><td className="num p-2">{usd(r.high)}</td><td className="num p-2">{pct(r.hitRate)}</td><td className="num p-2">{r.tests}</td></tr>)}</tbody></table></div></> : <Unavailable text="No positions have sufficient continuous history and a walk-forward track record for this scenario." />}
          <p className="text-xs text-ink-2">A simultaneous shock, not a portfolio probability interval or maximum loss. Unmodeled balances are not assumed safe.</p>{stress.missing.map((m, i) => <p key={i} className="text-xs text-ink-muted">{m}</p>)}<p className="num text-xs text-ink-muted">{stress.tally.calls} Nansen calls · {stress.tally.credits} credits · {stress.tally.cached} cached</p></div>}
      </Card>
    </>}
  </div>;
}

/** Binary area partition. No chart runtime: keyboard-accessible SVG links
 * and a complete table remain usable in both themes and on small screens. */
function AllocationMap({ positions }: { positions: Position[] }) {
  const top = positions.slice(0, 24), remaining = positions.slice(24).reduce((s, p) => s + p.valueUsd, 0);
  const items = [...top, ...(remaining ? [{ chain: '', tokenAddress: '', symbol: 'Other', valueUsd: remaining, wallets: [] }] : [])];
  const tiles: Array<{ p: Position; x: number; y: number; w: number; h: number }> = [];
  function split(rows: Position[], x: number, y: number, w: number, h: number) {
    if (rows.length === 1) { tiles.push({ p: rows[0], x, y, w, h }); return; }
    const total = rows.reduce((s, p) => s + p.valueUsd, 0); let cut = 1, sum = rows[0].valueUsd;
    while (cut < rows.length - 1 && sum < total / 2) { sum += rows[cut].valueUsd; cut++; }
    const fraction = sum / total;
    if (w >= h) { split(rows.slice(0, cut), x, y, w * fraction, h); split(rows.slice(cut), x + w * fraction, y, w * (1 - fraction), h); }
    else { split(rows.slice(0, cut), x, y, w, h * fraction); split(rows.slice(cut), x, y + h * fraction, w, h * (1 - fraction)); }
  }
  if (items.length) split(items, 0, 0, 960, 340);
  return <svg viewBox="0 0 960 340" role="img" aria-label="Portfolio allocation map; block area equals USD value" className="w-full rounded-xl">{tiles.map(({ p, x, y, w, h }, i) => {
    const content = <><title>{p.symbol} · {chainName(p.chain)} · {usd(p.valueUsd)}</title><rect x={x + 1} y={y + 1} width={Math.max(0, w - 2)} height={Math.max(0, h - 2)} rx="5" fill={`var(--${i % 2 ? 'out' : 'in'}-1)`} fillOpacity=".16" stroke="var(--border)" />{w > 80 && h > 48 && <><text x={x + 12} y={y + 26} fill="var(--ink-1)" fontSize={w > 180 ? 20 : 13}>{p.symbol.slice(0, Math.floor(w / 12))}</text><text x={x + 12} y={y + 45} fill="var(--ink-2)" fontSize="12">{usd(p.valueUsd)}</text>{h > 80 && <text x={x + 12} y={y + h - 14} fill="var(--ink-muted)" fontSize="11">{chainName(p.chain)}</text>}</>}</>;
    return p.tokenAddress ? <a key={i} href={`/token/${p.chain}/${encodeURIComponent(p.tokenAddress)}`} aria-label={`${p.symbol} on ${chainName(p.chain)}, ${usd(p.valueUsd)}`}>{content}</a> : <g key={i}>{content}</g>;
  })}</svg>;
}
