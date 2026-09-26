'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, Unavailable, WaveLoading } from '@/components/Card';
import { InfoPopover } from '@/components/InfoPopover';
import type { Portfolio, PortfolioStress } from '@/server/portfolio/portfolio';
import type { Position } from '@/lib/models/portfolio';
import type { DeskData } from '@/server/wallet/desk';
import { chainName, pct, shortAddress, usd } from '@/lib/viz/format';
import { PageTitle } from '@/components/PageTitle';
import { Go } from '@/components/ui/Icons';
import { TokenLogo } from '@/components/Logo';
import { useSite } from '@/components/SiteContext';

const DEMO = '0xcbb811f129782ef87e19dea9d3375045219bae00';
const button = 'rounded-lg border border-border px-3 py-2 text-sm text-ink hover:bg-accent disabled:opacity-50';

export function PortfolioView({ demo, suggestions = [], embedded = false }: { demo: boolean; suggestions?: Array<{ address: string; label: string | null }>; embedded?: boolean }) {
  const { accounts } = useSite();
  const [input, setInput] = useState(''),
    [canSave, setCanSave] = useState(false);
  const [p, setP] = useState<Portfolio | null>(null),
    [stress, setStress] = useState<PortfolioStress | null>(null);
  const [connections, setConnections] = useState<DeskData | null>(null);
  const [busy, setBusy] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  // The saved watch set fills the box only if the visitor has not already
  // typed or picked wallets: on a slow load the answer can arrive after
  // they have, and must not wipe their choice.
  useEffect(() => {
    let mounted = true;
    fetch('/api/portfolio')
      .then((r) => r.json())
      .then((d) => {
        if (mounted) {
          setCanSave(d.canSave);
          // Open on data: the saved set, else the largest Smart Money wallets, analyzed straight away.
          const start: string[] = d.addresses?.length ? d.addresses : suggestions.map((w) => w.address);
          setInput((cur) => (cur.trim() ? cur : start.join('\n')));
          if (start.length) void (async () => { await run('analyze', start); await run('stress', start); await run('counterparties', start); })();
        }
      })
      .catch(() => {
        if (mounted) setError('Saved wallets could not be loaded. You can still analyze addresses below.');
      });
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on open
  }, []);
  async function run(action: 'analyze' | 'stress' | 'save' | 'counterparties', list?: string[]) {
    setBusy(action);
    setError('');
    setMessage('');
    if (action === 'analyze') {
      setP(null);
      setStress(null);
      setConnections(null);
    }
    if (action === 'stress') setStress(null);
    try {
      const addresses = list ?? input.split(/[\s,]+/).filter(Boolean);
      const r = await fetch('/api/portfolio', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, addresses }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'The portfolio request failed.');
      if (action === 'analyze') setP(data);
      else if (action === 'stress') setStress(data);
      else if (action === 'counterparties') setConnections(data);
      else setMessage('Watch set saved to your account.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy('');
    }
  }
  return (
    <div className="space-y-5">
      {!embedded && <PageTitle title="Profiler" pill="Portfolio: up to five wallets, one view" />}
      <Card
        id="watchset"
        title="Portfolio of up to five wallets"
        sub="One address per line"
      >
        <label htmlFor="portfolio-addresses" className="mb-2 block text-xs text-ink-2">
          Wallet addresses
        </label>
        <textarea
          id="portfolio-addresses"
          rows={3}
          value={input}
          disabled={!!busy}
          onChange={(e) => {
            setInput(e.target.value);
            setP(null);
            setStress(null);
            setMessage('');
            setError('');
          }}
          placeholder="0x… or a Solana, Bitcoin, Sui, TON, NEAR… wallet"
          className="num w-full rounded-lg border border-border bg-background p-3 text-xs"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className={`${button} bg-accent`} disabled={!!busy || !input.trim()} onClick={() => run('analyze')}>
            Analyze
          </button>
          {accounts && (
            <button className={button} disabled={!!busy || !canSave} onClick={() => run('save')}>
              Save watch set
            </button>
          )}
          {suggestions.length > 0 && (
            <button className={button} disabled={!!busy} title={suggestions.map((w) => w.label ?? w.address).join('\n')}
              onClick={() => { setInput(suggestions.map((w) => w.address).join('\n')); setP(null); setStress(null); }}>
              Load the 5 largest Smart Money wallets
            </button>
          )}
          {demo && (
            <button
              className={button}
              disabled={!!busy}
              onClick={() => {
                setInput(DEMO);
                setP(null);
                setStress(null);
              }}
            >
              Use recorded demo wallet
            </button>
          )}
        </div>
        {!canSave && accounts && (
          <p className="needs-account mt-2 text-xs text-ink-muted">
            Sign in to save a private watch set. Analysis does not require a wallet connection.
          </p>
        )}
        <div aria-live="polite" className="mt-3">
          {error && <Unavailable text={error} />}
          {message && <p className="text-sm">{message}</p>}
          {busy === 'analyze' && <WaveLoading what="portfolio balances" height={140} />}
        </div>
      </Card>
      {p && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Priced spot holdings', usd(p.exposure.total)],
              ['Largest position', p.exposure.largestShare == null ? 'n/a' : pct(p.exposure.largestShare)],
              ['Effective positions', p.exposure.effectivePositions?.toFixed(1) ?? 'n/a'],
            ].map(([label, value]) => (
              <div key={label} className="inset-well rounded-[18px] p-5">
                <div className="text-xs text-ink-muted">{label}</div>
                <div className="num mt-2 text-3xl">{value}</div>
              </div>
            ))}
          </div>
          <Card
            id="portfolio-allocation"
            title={`${p.exposure.byChain.length} chains · ${p.positions.length} priced positions`}
            sub="Each area is proportional to its USD value. Open a block to inspect the token; the table includes every position."
            action={<InfoPopover p={p.provenance} />}
          >
            {p.positions.length ? (
              <>
                <AllocationMap positions={p.positions} />
                <div className="mt-5 max-h-96 overflow-auto">
                  <table data-sortable className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-ink-muted">
                        <th className="p-2">Token</th>
                        <th className="p-2">Chain</th>
                        <th className="p-2 text-right">Value</th>
                        <th className="p-2 text-right">Share</th>
                        <th className="p-2 text-right">Wallets</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.positions.map((x) => (
                        <tr key={`${x.chain}:${x.tokenAddress}`} className="border-t border-border/50">
                          <td className="p-2">
                            <Link className="inline-flex items-center gap-1.5 font-semibold hover:underline" href={`/token/${x.chain}/${encodeURIComponent(x.tokenAddress)}`}>
                              <TokenLogo symbol={x.symbol} chain={x.chain} address={x.tokenAddress} size={16} />{x.symbol}
                            </Link>
                          </td>
                          <td className="p-2">{chainName(x.chain)}</td>
                          <td className="num p-2 text-right">{usd(x.valueUsd)}</td>
                          <td className="num p-2 text-right">{pct(x.valueUsd / p.exposure.total)}</td>
                          <td className="num p-2 text-right">{x.wallets.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <Unavailable text="No priced spot positions were available. Check each wallet's result below." />
            )}
            <p className="mt-3 text-xs text-ink-muted">
              Spot balances only. Unpriced assets, DeFi receipt-token overlap and derivative collateral are excluded from this analysis.
            </p>
          </Card>
          <Card id="portfolio-wallets" title="Wallet coverage">
            <ul className="space-y-2">
              {p.wallets.map((w) => (
                <li key={w.address} className="rounded-lg bg-accent/30 p-3 text-xs">
                  <Link href={`/wallet/${encodeURIComponent(w.address)}`} className="num hover:underline">
                    {shortAddress(w.address)} <Go />
                  </Link>
                  <span className="ml-3">{w.totalUsd == null ? 'Unavailable' : usd(w.totalUsd)}</span>
                  {w.error && <p className="mt-1 text-ink-muted">{w.error}</p>}
                  {w.limited && <p className="mt-1 text-ink-muted">Only the largest 200 positions are included.</p>}
                </li>
              ))}
            </ul>
          </Card>
          <Card
            id="portfolio-storm"
            title="How much of the portfolio has a Dump Risk reading?"
            sub="Value-weighted local readings from the last 24 hours."
            action={<InfoPopover p={p.provenance} />}
          >
            <p className="num text-2xl">{p.storm.score == null ? 'No recent reading' : `${p.storm.score.toFixed(0)} / 100`}</p>
            <p className="mt-2 text-sm text-ink-2">
              {usd(p.storm.coveredUsd)} of {usd(p.exposure.total)} covered. Positions without a reading remain unknown.
            </p>
            <ul className="mt-3 space-y-2">
              {p.storm.rows.map((s) => (
                <li key={`${s.chain}:${s.tokenAddress}`} className="flex items-center gap-3 text-xs">
                  <Link className="inline-flex w-24 items-center gap-1 truncate hover:underline" href={`/token/${s.chain}/${encodeURIComponent(s.tokenAddress)}`}>
                    <TokenLogo symbol={s.symbol} chain={s.chain} address={s.tokenAddress} size={14} />{s.symbol}
                  </Link>
                  <span className="h-2 flex-1 rounded bg-accent">
                    <span className="block h-2 rounded bg-storm-3" style={{ width: `${s.score}%` }} />
                  </span>
                  <span className="num">
                    {s.score.toFixed(0)} · {usd(s.valueUsd)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card
            id="portfolio-connections"
            title="Who connects these wallets?"
            sub="Inspect transfer counterparties across EVM or Solana wallets, with separate coverage for each ecosystem."
          >
            <button className={button} disabled={!!busy} onClick={() => run('counterparties')}>
              Load counterparties
            </button>
            {busy === 'counterparties' && <WaveLoading what="counterparty connections" height={120} />}
            {connections && (
              <div className="mt-4 space-y-3">
                <div className="flex justify-between">
                  <p className="text-xs text-ink-2">{connections.description}</p>
                  <InfoPopover p={connections.provenance} />
                </div>
                {connections.tables.map((t) => (
                  <div key={t.title}>
                    <h3 className="text-sm">{t.title}</h3>
                    <div className="mt-2 max-h-80 overflow-auto">
                      <table data-sortable className="w-full text-left text-xs">
                        <thead>
                          <tr>
                            {t.columns.map((c) => (
                              <th className="p-2 font-normal text-ink-muted" key={c}>
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {t.rows.map((row, i) => (
                            <tr className="border-t border-border" key={i}>
                              {row.map((v, j) => (
                                <td className="p-2" key={j}>
                                  {j < 2 && typeof v === 'string' ? (
                                    <Link title={v} href={`/wallet/${encodeURIComponent(v)}`} className="num hover:underline">
                                      {shortAddress(v)}
                                    </Link>
                                  ) : (
                                    (v ?? 'n/a')
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!t.rows.length && <Unavailable text="Nansen returned no counterparties for this request." />}
                  </div>
                ))}
                {connections.provenance.notes?.map((n) => (
                  <p key={n} className="text-xs text-ink-muted">
                    {n}
                  </p>
                ))}
              </div>
            )}
          </Card>
          <Card
            id="portfolio-stress"
            title="What if the largest positions move together?"
            sub="A seven-day sensitivity scenario for up to eight positions, using their own daily volatility and historical cone coverage."
          >
            <button className={button} disabled={!!busy || !p.positions.length} onClick={() => run('stress')}>
              Run stress scenario
            </button>
            {busy === 'stress' && (
              <div className="mt-3">
                <WaveLoading what="daily candles and track records" height={120} />
              </div>
            )}
            {stress && (
              <div className="mt-4 space-y-4">
                <div className="flex items-start justify-between">
                  <p className="text-sm">
                    {pct(stress.summary.coverage)} of available spot value modeled. {usd(stress.summary.unmodeled)} remains unmodeled.
                  </p>
                  <InfoPopover p={stress.provenance} />
                </div>
                {stress.failedWallets.length > 0 && (
                  <Unavailable
                    text={`${stress.failedWallets.length} wallet(s) were unavailable. Coverage refers only to the wallets that returned balances.`}
                  />
                )}
                {stress.rows.length ? (
                  <>
                    <div className="grid grid-cols-3 gap-2 rounded-xl bg-accent/40 p-4">
                      {[
                        ['Down scenario', stress.summary.low],
                        ['Modeled value now', stress.summary.covered],
                        ['Up scenario', stress.summary.high],
                      ].map(([label, value]) => (
                        <div key={String(label)}>
                          <p className="text-[11px] text-ink-muted">{label}</p>
                          <p className="num mt-1 text-lg sm:text-2xl">{usd(value as number)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="overflow-auto">
                      <table data-sortable className="w-full text-left text-xs">
                        <thead>
                          <tr>
                            {['Token', 'Down scenario', 'Now', 'Up scenario', 'Historical coverage', 'Test windows'].map((c) => (
                              <th key={c} className="p-2 font-normal text-ink-muted">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stress.rows.map((r) => (
                            <tr className="border-t border-border" key={`${r.chain}:${r.tokenAddress}`}>
                              <td className="p-2">
                                <span className="inline-flex items-center gap-1.5"><TokenLogo symbol={r.symbol} chain={r.chain} address={r.tokenAddress} size={16} />{r.symbol} · {chainName(r.chain)}</span>
                              </td>
                              <td className="num p-2">{usd(r.low)}</td>
                              <td className="num p-2">{usd(r.valueUsd)}</td>
                              <td className="num p-2">{usd(r.high)}</td>
                              <td className="num p-2">{pct(r.hitRate)}</td>
                              <td className="num p-2">{r.tests}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <Unavailable text="No positions have sufficient continuous history and a walk-forward track record for this scenario." />
                )}
                <p className="text-xs text-ink-2">
                  A simultaneous shock, not a portfolio probability interval or maximum loss. Unmodeled balances are not assumed safe.
                </p>
                {stress.missing.map((m, i) => (
                  <p key={i} className="text-xs text-ink-muted">
                    {m}
                  </p>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/** Binary area partition. No chart runtime: keyboard-accessible SVG links
 * and a complete table remain usable in both themes and on small screens. */
function AllocationMap({ positions }: { positions: Position[] }) {
  const top = positions.slice(0, 24),
    remaining = positions.slice(24).reduce((s, p) => s + p.valueUsd, 0);
  const items = [...top, ...(remaining ? [{ chain: '', tokenAddress: '', symbol: 'Other', valueUsd: remaining, wallets: [] }] : [])];
  const tiles: Array<{ p: Position; x: number; y: number; w: number; h: number }> = [];
  function split(rows: Position[], x: number, y: number, w: number, h: number) {
    if (rows.length === 1) {
      tiles.push({ p: rows[0], x, y, w, h });
      return;
    }
    const total = rows.reduce((s, p) => s + p.valueUsd, 0);
    let cut = 1,
      sum = rows[0].valueUsd;
    while (cut < rows.length - 1 && sum < total / 2) {
      sum += rows[cut].valueUsd;
      cut++;
    }
    const fraction = sum / total;
    if (w >= h) {
      split(rows.slice(0, cut), x, y, w * fraction, h);
      split(rows.slice(cut), x + w * fraction, y, w * (1 - fraction), h);
    } else {
      split(rows.slice(0, cut), x, y, w, h * fraction);
      split(rows.slice(cut), x, y + h * fraction, w, h * (1 - fraction));
    }
  }
  if (items.length) split(items, 0, 0, 960, 340);
  return (
    <div role="img" aria-label="Portfolio allocation map; block area equals USD value" className="relative w-full" style={{ aspectRatio: '960 / 340' }}>
      {tiles.map(({ p, x, y, w, h }, i) => {
        // Tiles are laid out on a 960×340 grid; show as much as the block has room for.
        const big = w > 150 && h > 90, mid = w > 70 && h > 44, tiny = w > 20 && h > 20;
        const logo = Math.round(big ? 28 : mid ? 18 : Math.min(16, w - 6, h - 6));
        const body = (
          <>
            {tiny && (
              <span className={big || mid ? 'flex min-w-0 items-center gap-1.5' : 'grid h-full place-items-center'}>
                <TokenLogo symbol={p.symbol} chain={p.chain} address={p.tokenAddress ?? undefined} size={logo} />
                {mid && <span className={`truncate font-semibold text-ink ${big ? 'text-[18px]' : 'text-[12.5px]'}`}>{p.symbol}</span>}
              </span>
            )}
            {mid && <span className={`num mt-0.5 block truncate text-ink-2 ${big ? 'text-[13px]' : 'text-[11px]'}`}>{usd(p.valueUsd)}</span>}
            {big && <span className="absolute bottom-2 left-3 truncate text-[11.5px] text-ink-muted">{chainName(p.chain)}</span>}
          </>
        );
        const style = { background: `color-mix(in srgb, var(--mint) ${Math.max(4, Math.round(16 - i * 0.6))}%, var(--surface-1))`, left: `${(x / 960) * 100}%`, top: `${(y / 340) * 100}%`, width: `${(w / 960) * 100}%`, height: `${(h / 340) * 100}%` };
        const cls = `absolute overflow-hidden rounded-[6px] border border-[var(--hair)] ${mid ? 'p-2.5' : 'p-0.5'} outline-offset-[-2px] transition-colors hover:border-[var(--mint)]`;
        const title = `${p.symbol} · ${chainName(p.chain)} · ${usd(p.valueUsd)}`;
        return p.tokenAddress ? (
          <a key={i} href={`/token/${p.chain}/${encodeURIComponent(p.tokenAddress)}`} title={title} aria-label={`${p.symbol} on ${chainName(p.chain)}, ${usd(p.valueUsd)}`} className={cls} style={style}>{body}</a>
        ) : (
          <div key={i} title={title} className={cls} style={style}>{body}</div>
        );
      })}
    </div>
  );
}
