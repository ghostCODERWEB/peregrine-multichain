import Link from 'next/link';
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
        <Link href={href} className="text-[12px] font-semibold text-brand">Open <Go /></Link>
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
        <span className="num shrink-0 whitespace-nowrap font-semibold" style={tone(w.net)}>{usd(w.net, { signed: true })} <span className="font-normal text-ink-muted">· {w.n} trades</span></span>
      </span>
      <RowBar value={w.net} max={walletMax} />
    </li>
  );

  const tokRow = (t: Tok) => (
    <li key={`${t.chain}:${t.token}`} className="py-1 text-[12.5px]">
      <span className="flex items-center justify-between gap-2">
        <Link href={`/token/${t.chain}/${encodeURIComponent(t.token)}`} className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-ink hover:underline"><TokenLogo symbol={t.sym} chain={t.chain} address={t.token} size={16} />{t.sym ?? t.token.slice(0, 6)} <span className="font-normal text-ink-muted">{chainName(t.chain)} · {t.wallets} wallet{t.wallets === 1 ? '' : 's'}</span></Link>
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
    {owner && <div className="mb-2 flex justify-end"><ExplainView view="overview" context={context} coins={['BTC', 'ETH', 'SOL']} /></div>}
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
            <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ink-2">Largest SM perp: <AddressLink address={bigPerp.address} label={bigPerp.label} compact /> <span className="num whitespace-nowrap font-semibold" style={{ color: bigPerp.side === 'long' ? 'var(--mint)' : 'var(--flare)' }}>{bigPerp.side} BTC {usd(bigPerp.value)}</span></p>
          )}
        </Module>
      )}
      <Module title="What changed, 24h" href="/history">
        <ol className="space-y-1">
          {moves.map((m) => (
            <li key={m.chain} className="grid grid-cols-[minmax(0,1fr)_72px_auto] items-center gap-2 text-[12.5px]">
              <Link href={`/chain/${m.chain}`} className="truncate font-semibold text-ink hover:underline">{chainName(m.chain)} Flow Index</Link>
              <MiniLines height={18} min={0} max={100} baseline={50} label={`${chainName(m.chain)} Flow Index, last 24 hours`} series={[{ values: cpiLine(m.chain), color: m.d >= 0 ? 'var(--mint)' : 'var(--flare)' }]} />
              <span className="num whitespace-nowrap"><span className="text-ink-2">{num(m.v, 0)}</span> <span className="font-semibold" style={tone(m.d)}>{m.d >= 0 ? '+' : '−'}{num(Math.abs(m.d), 0)}</span></span>
            </li>
          ))}
          {!moves.length && <li className="text-[12.5px] text-ink-muted">Comparisons appear once the scanner has a day of history.</li>}
        </ol>
      </Module>
    </div>
    </div>
  );
}
