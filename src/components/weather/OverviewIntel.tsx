import Link from 'next/link';
import { HrefLogo } from '@/components/HrefLogo';
import { getDb } from '@/server/nansen/db';
import { perpBoard } from '@/server/perps/board';
import { perpChanges } from '@/server/perps/terminal';
import type { DisplayMode } from '@/server/mode';
import { DIRECTION_TEXT } from '@/lib/perps/changes';
import { chainName, num, pct, usd } from '@/lib/viz/format';
import { Go } from '@/components/ui/Icons';
import { AddressLink } from '@/components/entity/AddressLink';
import { TokenLogo } from '@/components/Logo';
import { MarketPulse } from '@/components/pulse/MarketPulse';
import { perpsAnalytics, sectorsAnalytics } from '@/server/insights';
import { ChainLogo } from '@/components/Logo';
import { ExplainView } from '@/components/ExplainView';
import { MiniBars, MiniLines, RowBar } from '@/components/charts/Mini';
import { positioningSeries, smFlowSeries } from '@/server/graph/series';

type Tok = { chain: string; token: string; sym: string | null; net: number; wallets: number };

const tone = (v: number) => ({ color: v >= 0 ? 'var(--mint)' : 'var(--flare)' });

function Module({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="material flex min-w-0 flex-col p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13.5px] font-bold text-ink">{title}</h2>
        <Link prefetch={false} href={href} className="text-[12px] font-semibold text-brand">Open <Go /></Link>
      </div>
      {children}
    </section>
  );
}

/** Overview's second row: Smart Money spot flow, perp positioning and what changed, each with its drivers. */
export function OverviewIntel({ mode }: { mode: DisplayMode }) {
  const db = getDb();
  const owner = mode === 'owner';
  const now = Date.now(), day = 86_400_000;
  const flow = (from: number, to: number) => db.prepare(`SELECT SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT wallet) AS w FROM smart_money_trades WHERE traded_at >= ? AND traded_at < ?`).get(from, to) as { net: number | null; w: number };
  const cur = owner ? flow(now - day, now) : null, prev = owner ? flow(now - 2 * day, now - day) : null;
  const toks = owner ? (db.prepare(`SELECT chain, token_address AS token, MAX(token_symbol) AS sym, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(DISTINCT wallet) AS wallets FROM smart_money_trades WHERE traded_at >= ? GROUP BY chain, token_address`).all(now - day) as Tok[]) : [];
  const buys = [...toks].sort((a, b) => b.net - a.net).filter((t) => t.net > 0).slice(0, 3);
  const sells = [...toks].sort((a, b) => a.net - b.net).filter((t) => t.net < 0).slice(0, 3);
  const board = perpBoard(owner ? 'private' : 'public', now);
  const shift = owner ? perpChanges('BTC', 4 * 3_600_000) : null;
  const latest = owner ? (db.prepare(`SELECT positions FROM perp_position_snapshots WHERE symbol = 'BTC' ORDER BY at DESC LIMIT 1`).get() as { positions: string } | undefined) : undefined;
  let smLong = 0, smShort = 0;
  if (latest) for (const p of JSON.parse(latest.positions) as Array<[string, string | null, number, number, ...unknown[]]>) if (String(p[9] ?? '').includes('smart_money')) { if (p[2]) smLong += p[3]; else smShort += p[3]; }
  const source = owner ? 'smart-money' : 'market-flow';
  const cpi = (t: number) => new Map((db.prepare(`SELECT c.chain AS k, c.cpi AS v FROM chain_cpi c JOIN (SELECT chain, MAX(snapshot_at) s FROM chain_cpi WHERE source = ? AND snapshot_at <= ? GROUP BY chain) m ON m.chain = c.chain AND m.s = c.snapshot_at WHERE c.source = ?`).all(source, t, source) as Array<{ k: string; v: number }>).map((r) => [r.k, r.v]));
  const a = cpi(now), b = cpi(now - day);
  const moves = [...a].filter(([k]) => b.has(k)).map(([k, v]) => ({ chain: k, d: v - b.get(k)!, v })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 6);
  // The day's other large changes, each linking to its page.
  const sec = sectorsAnalytics(mode).change[0];
  const pa = perpsAnalytics(mode);
  const others = [
    owner && cur && prev?.net != null ? { kind: 'Smart Money DEX', label: 'net vs prior day', value: usd((cur.net ?? 0) - prev.net, { signed: true }), up: (cur.net ?? 0) >= prev.net, href: '/smart-money' } : null,
    sec ? { kind: 'Sector', label: sec.label, value: usd(sec.value, { signed: true }), up: sec.value >= 0, href: sec.href } : null,
    pa.oiMovers[0] ? { kind: 'Perp OI', label: pa.oiMovers[0].label, value: `${pa.oiMovers[0].value >= 0 ? '+' : '−'}${Math.abs(pa.oiMovers[0].value).toFixed(0)}%`, up: pa.oiMovers[0].value >= 0, href: pa.oiMovers[0].href } : null,
    pa.priceMovers[0] ? { kind: 'Perp price', label: pa.priceMovers[0].label, value: `${pa.priceMovers[0].value >= 0 ? '+' : '−'}${Math.abs(pa.priceMovers[0].value).toFixed(1)}%`, up: pa.priceMovers[0].value >= 0, href: pa.priceMovers[0].href } : null,
  ].filter((x): x is { kind: string; label: string; value: string; up: boolean; href: string } => !!x);
  const cpiLine = (chain: string) => (db.prepare('SELECT cpi FROM chain_cpi WHERE chain = ? AND source = ? AND snapshot_at >= ? ORDER BY snapshot_at').all(chain, source, now - day) as Array<{ cpi: number }>).map((r) => r.cpi);
  const hourly = owner ? smFlowSeries(24, now) : [];
  const posh = owner ? positioningSeries('BTC').slice(-48) : [];
  const tokMax = Math.max(0, ...[...buys, ...sells].map((t) => Math.abs(t.net)));

  const wallets = owner ? (db.prepare(`SELECT wallet, MAX(wallet_label) AS label, SUM(CASE WHEN side='buy' THEN usd_value ELSE -usd_value END) AS net, COUNT(*) AS n FROM smart_money_trades WHERE traded_at >= ? GROUP BY wallet`).all(now - day) as Array<{ wallet: string; label: string | null; net: number; n: number }>) : [];
  const topBuyers = [...wallets].sort((a, b) => b.net - a.net).filter((w) => w.net > 0).slice(0, 2);
  const topSellers = [...wallets].sort((a, b) => a.net - b.net).filter((w) => w.net < 0).slice(0, 2);
  const walletMax = Math.max(0, ...[...topBuyers, ...topSellers].map((w) => Math.abs(w.net)));
  let bigPerp: { address: string; label: string | null; side: string; value: number } | null = null;
  if (latest) for (const p of JSON.parse(latest.positions) as Array<[string, string | null, number, number, ...unknown[]]>) if (String(p[9] ?? '').includes('smart_money') && (!bigPerp || p[3] > bigPerp.value)) bigPerp = { address: p[0], label: p[1], side: p[2] ? 'long' : 'short', value: p[3] };
  const walletRow = (w: { wallet: string; label: string | null; net: number; n: number }) => (
    <li key={w.wallet} className="py-1 text-[12.5px]">
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate"><AddressLink address={w.wallet} label={w.label} compact /></span>
        <span className="num shrink-0 whitespace-nowrap font-semibold" style={tone(w.net)}>{usd(w.net, { signed: true })} <span className="font-normal text-ink-muted">· {w.n} trade{w.n === 1 ? '' : 's'}</span></span>
      </span>
      <RowBar value={w.net} max={walletMax} />
    </li>
  );

  const tokRow = (t: Tok) => (
    <li key={`${t.chain}:${t.token}`} className="py-1 text-[12.5px]">
      <span className="flex items-center justify-between gap-2">
        <Link prefetch={false} href={`/token/${t.chain}/${encodeURIComponent(t.token)}`} className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-ink hover:underline"><TokenLogo symbol={t.sym} chain={t.chain} address={t.token} size={16} />{t.sym ?? t.token.slice(0, 6)} <span className="font-normal text-ink-muted">{chainName(t.chain)} · {t.wallets} wallet{t.wallets === 1 ? '' : 's'}</span></Link>
        <span className="num shrink-0 whitespace-nowrap font-semibold" style={tone(t.net)}>{usd(t.net, { signed: true })}</span>
      </span>
      <RowBar value={t.net} max={tokMax} />
    </li>
  );

  const context = {
    window: 'last 24h',
    smartMoneyDex: cur && { netUsd: cur.net, wallets: cur.w, prior24hNetUsd: prev?.net, bought: buys.map((t) => ({ symbol: t.sym, chain: t.chain, netUsd: Math.round(t.net), wallets: t.wallets })), sold: sells.map((t) => ({ symbol: t.sym, chain: t.chain, netUsd: Math.round(t.net), wallets: t.wallets })) },
    perps: { openInterestUsd: board.venue?.openInterest, perpFlowIndex: board.venue?.ppi, btcSmartMoneyLongUsd: Math.round(smLong), btcSmartMoneyShortUsd: Math.round(smShort) },
    walletsThatMatter: [...topBuyers, ...topSellers].map((w) => ({ address: w.wallet, label: w.label, netUsd: Math.round(w.net) })),
    flowIndexMoves24h: moves.map((m) => ({ chain: m.chain, now: Math.round(m.v), change: Math.round(m.d) })),
  };
  return (
    <div className="xl:col-span-12">
    <div className="mb-4"><MarketPulse mode={mode} /></div>
    {owner && <ExplainView view="overview" context={context} coins={['BTC', 'ETH', 'SOL']} />}
    <div className="stagger grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {owner && cur && (
        <Module title="Smart Money on DEXs, 24h" href="/smart-money">
          <p className="num text-[22px] font-bold tracking-[-0.02em]" style={tone(cur.net ?? 0)}>{usd(cur.net, { signed: true })}</p>
          <p className="text-[12px] text-ink-2">{cur.w} wallets{prev?.net ? ` · prior 24h ${usd(prev.net, { signed: true })}` : ''}</p>
          {hourly.length > 1 && (
            <div className="mt-2">
              <MiniBars values={hourly.map((h) => h.net)} label="Smart Money net DEX flow per hour, last 24 hours" title={(i) => `${new Date(hourly[i].t).toISOString().slice(11, 13)}:00 UTC · ${usd(hourly[i].net, { signed: true })} · ${hourly[i].wallets} wallets`} />
              <p className="mt-0.5 flex justify-between text-[10.5px] text-ink-muted"><span>net per hour</span><span>{hourly.filter((h) => h.net > 0).length} of {hourly.length} hours net buying</span></p>
            </div>
          )}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div><p className="text-[11.5px] font-semibold text-ink-muted">Bought most</p><ol>{buys.map(tokRow)}</ol></div>
            <div><p className="text-[11.5px] font-semibold text-ink-muted">Sold most</p><ol>{sells.map(tokRow)}</ol></div>
          </div>
        </Module>
      )}
      <Module title="Perps" href="/perps/BTC">
        <p className="num text-[22px] font-bold tracking-[-0.02em] text-ink">{board.venue ? usd(board.venue.openInterest) : 'n/a'}</p>
        <p className="text-[12px] text-ink-2">Hyperliquid open interest{board.venue?.ppi != null ? ` · Perp Flow Index ${num(board.venue.ppi, 0)}` : ''}</p>
        {/* Without the owner's Smart Money book, the largest markets: public Hyperliquid data the board already holds. */}
        {!(owner && (smLong + smShort) > 0) && board.coins.length > 0 && (
          <div className="mt-3">
            <p className="text-[11.5px] font-semibold text-ink-muted">Largest by open interest</p>
            <ol className="mt-1 space-y-1">
              {[...board.coins].sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0)).slice(0, 5).map((c) => (
                <li key={c.symbol} className="grid grid-cols-[minmax(0,1fr)_auto_52px] items-center gap-2 text-[12.5px]">
                  <Link prefetch={false} href={`/perps/${encodeURIComponent(c.symbol)}`} className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-ink hover:underline">
                    <TokenLogo symbol={c.symbol} coin={c.symbol} size={14} />{c.symbol.replace(/^[^:]+:/, '')}
                  </Link>
                  <span className="num text-ink-2">{usd(c.openInterest)}</span>
                  <span className="num text-right font-semibold" style={tone(c.change24h ?? 0)}>{c.change24h != null ? `${c.change24h >= 0 ? '+' : '−'}${Math.abs(c.change24h * 100).toFixed(1)}%` : 'n/a'}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        {owner && (smLong + smShort) > 0 && (
          <div className="mt-3 space-y-1.5 text-[12.5px]">
            <p className="text-[11.5px] font-semibold text-ink-muted">BTC Smart Money book (observed)</p>
            <div className="flex h-2 overflow-hidden rounded-full"><span style={{ width: `${(smLong / (smLong + smShort)) * 100}%`, background: 'var(--mint)' }} /><span className="flex-1" style={{ background: 'var(--flare)' }} /></div>
            <p className="num text-ink-2">{usd(smLong)} long · {usd(smShort)} short · {pct(smLong / (smLong + smShort), 0)} long</p>
            {shift && !('unavailable' in shift) && <p className="text-ink-2">4h: <span className="font-semibold text-ink">{DIRECTION_TEXT[(shift.shift.smart_money ?? shift.shift.all).direction]}</span></p>}
            {posh.length > 2 && (
              <div className="pt-1">
                <MiniLines label="BTC Smart Money long and short exposure across stored snapshots" series={[{ values: posh.map((p) => p.smLong), color: 'var(--mint)', area: true }, { values: posh.map((p) => p.smShort), color: 'var(--flare)', area: true }]} />
                <p className="mt-0.5 flex justify-between text-[10.5px] text-ink-muted"><span><span style={{ color: 'var(--mint)' }}>long</span> vs <span style={{ color: 'var(--flare)' }}>short</span>, {posh.length} snapshots</span><span>since {new Date(posh[0].at).toISOString().slice(5, 10)}</span></p>
              </div>
            )}
          </div>
        )}
      </Module>
      {owner && (topBuyers.length > 0 || bigPerp) && (
        <Module title="Wallets that matter, 24h" href="/wallet">
          <p className="text-[11.5px] font-semibold text-ink-muted">Largest Smart Money net buyers</p>
          <ol>{topBuyers.map(walletRow)}</ol>
          <p className="mt-2 text-[11.5px] font-semibold text-ink-muted">Largest net sellers</p>
          <ol>{topSellers.map(walletRow)}</ol>
          {bigPerp && (
            <p className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-[12.5px] text-ink-2"><span className="whitespace-nowrap text-ink-muted">Largest SM perp</span><span className="min-w-0 truncate"><AddressLink address={bigPerp.address} label={bigPerp.label} compact /></span><span className="num whitespace-nowrap font-semibold" style={{ color: bigPerp.side === 'long' ? 'var(--mint)' : 'var(--flare)' }}>{bigPerp.side} BTC {usd(bigPerp.value)}</span></p>
          )}
        </Module>
      )}
      <Module title="What changed, 24h" href="/history">
        <p className="num mb-2 text-[11.5px] text-ink-muted">
          Flow Index · <span style={{ color: 'var(--mint)' }}>{moves.filter((m) => m.d > 0).length} up</span> · <span style={{ color: 'var(--flare)' }}>{moves.filter((m) => m.d < 0).length} down</span>
        </p>
        <ol className="space-y-1">
          {moves.map((m) => (
            <li key={m.chain} className="grid grid-cols-[minmax(0,1fr)_64px_auto] items-center gap-2 text-[12.5px]">
              <Link prefetch={false} href={`/chain/${m.chain}`} className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-ink hover:underline"><ChainLogo chain={m.chain} size={14} />{chainName(m.chain)}</Link>
              <MiniLines height={18} min={0} max={100} baseline={50} label={`${chainName(m.chain)} Flow Index, last 24 hours`} series={[{ values: cpiLine(m.chain), color: m.d >= 0 ? 'var(--mint)' : 'var(--flare)' }]} />
              <span className="num whitespace-nowrap"><span className="text-ink-2">{num(m.v, 0)}</span> <span className="font-semibold" style={tone(m.d)}>{m.d >= 0 ? '+' : '−'}{num(Math.abs(m.d), 0)}</span></span>
            </li>
          ))}
          {!moves.length && <li className="text-[12.5px] text-ink-muted">Comparisons appear once the scanner has a day of history.</li>}
        </ol>
        {others.length > 0 && (
          <>
            <p className="mb-1 mt-3 border-t border-[var(--hair)] pt-2.5 text-[11.5px] font-semibold text-ink-muted">Also moved</p>
            <ol className="space-y-1">
              {others.map((o) => (
                <li key={o.label}>
                  <Link prefetch={false} href={o.href} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-[12.5px] hover:underline">
                    <span className="flex min-w-0 items-center gap-1.5"><HrefLogo href={o.href} size={14} /><span className="truncate"><span className="text-ink-muted">{o.kind} </span><span className="font-semibold text-ink">{o.label}</span></span></span>
                    <span className="num whitespace-nowrap font-semibold" style={tone(o.up ? 1 : -1)}>{o.value}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </>
        )}
      </Module>
    </div>
    </div>
  );
}
