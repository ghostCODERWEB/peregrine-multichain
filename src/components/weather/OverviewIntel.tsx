import Link from 'next/link';
import { getDb } from '@/server/nansen/db';
import { perpBoard } from '@/server/perps/board';
import { perpChanges } from '@/server/perps/terminal';
import type { DisplayMode } from '@/server/mode';
import { DIRECTION_TEXT } from '@/lib/perps/changes';
import { chainName, num, pct, usd } from '@/lib/viz/format';
import { Go } from '@/components/ui/Icons';

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
  const cpi = (t: number) => new Map((db.prepare(`SELECT c.chain AS k, c.cpi AS v FROM chain_cpi c JOIN (SELECT chain, MAX(snapshot_at) s FROM chain_cpi WHERE snapshot_at <= ? GROUP BY chain) m ON m.chain = c.chain AND m.s = c.snapshot_at`).all(t) as Array<{ k: string; v: number }>).map((r) => [r.k, r.v]));
  const a = cpi(now), b = cpi(now - day);
  const moves = [...a].filter(([k]) => b.has(k)).map(([k, v]) => ({ chain: k, d: v - b.get(k)!, v })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 4);

  const tokRow = (t: Tok) => (
    <li key={`${t.chain}:${t.token}`} className="flex items-center justify-between gap-2 py-1 text-[12.5px]">
      <Link href={`/token/${t.chain}/${encodeURIComponent(t.token)}`} className="min-w-0 truncate font-semibold text-ink hover:underline">{t.sym ?? t.token.slice(0, 6)} <span className="font-normal text-ink-muted">{chainName(t.chain)} · {t.wallets} wallet{t.wallets === 1 ? '' : 's'}</span></Link>
      <span className="num shrink-0 whitespace-nowrap font-semibold" style={tone(t.net)}>{usd(t.net, { signed: true })}</span>
    </li>
  );

  return (
    <div className="stagger grid gap-4 lg:grid-cols-3 xl:col-span-12">
      {owner && cur && (
        <Module title="Smart Money on DEXs, 24h" href="/smart-money">
          <p className="num text-[22px] font-bold tracking-[-0.02em]" style={tone(cur.net ?? 0)}>{usd(cur.net, { signed: true })}</p>
          <p className="text-[12px] text-ink-2">{cur.w} wallets{prev?.net ? ` · prior 24h ${usd(prev.net, { signed: true })}` : ''}</p>
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
          </div>
        )}
      </Module>
      <Module title="What changed, 24h" href="/history">
        <ol className="space-y-1">
          {moves.map((m) => (
            <li key={m.chain} className="flex items-center justify-between gap-2 text-[12.5px]">
              <Link href={`/chain/${m.chain}`} className="font-semibold text-ink hover:underline">{chainName(m.chain)} Flow Index</Link>
              <span className="num"><span className="text-ink-2">now {num(m.v, 0)}</span> <span className="font-semibold" style={tone(m.d)}>{m.d >= 0 ? '+' : '−'}{num(Math.abs(m.d), 0)}</span></span>
            </li>
          ))}
          {!moves.length && <li className="text-[12.5px] text-ink-muted">Comparisons appear once the scanner has a day of history.</li>}
        </ol>
      </Module>
    </div>
  );
}
