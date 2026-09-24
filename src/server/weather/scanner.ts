// The scanner: TIDE's own time series. Each run snapshots every pressure-
// capable chain's smart-money net flow and volume into SQLite, derives the
// Chain Pressure Index against that chain's own accumulated history, and
// captures smart-money DEX trades for rotation-front matching.
//
// Nothing downstream can work without this running: CPI's z-score needs
// per-chain history, the Holt forecast needs a CPI series, and rotation
// fronts need trades from more than the trailing 24h the endpoint exposes
// at any one moment.
//
// Credit-aware by construction. Everything pressure-related comes from the
// token screener (1 credit per call, at most 5 chains per call), and each
// window is refetched on its own cadence — a 7-day volume total doesn't
// move in half an hour. See registry.ts pressureSource() for why Tier A
// reads the screener filtered to smart money rather than
// smart-money/netflow.
import { callNansen } from '@/server/nansen/client';
import { addressKey } from '@/lib/address-family';
import { getDb } from '@/server/nansen/db';
import { chainPressureWindow, blendChainPressure, flowRatio, type Window, type CpiWindowResult } from '@/lib/models/cpi';
import { classifySwap, isStablecoin } from '@/lib/models/trade-side';
import { pressureChains, pressureSource, type PressureSource } from '@/lib/registry';
import { stormSweep, sweepDue, type SweepCandidate } from '@/server/token/sweep';
import { storeSectorSnapshots } from '@/server/sectors/weather';
import type { SmartMoneyDexTrade } from '@/types/nansen/smart-money';

const WINDOWS: Window[] = ['1h', '24h', '7d'];

/** How often each window's inputs are refreshed. The 1h window is due
 *  every run; longer windows change slowly relative to their size. */
const WINDOW_CADENCE_MS: Record<Window, number> = {
  '1h': 0,
  '24h': 2 * 60 * 60_000,
  '7d': 12 * 60 * 60_000,
};

/** Below this many of a chain's own past snapshots, z is taken against
 *  peer chains at this moment instead (cpi.ts flags that as
 *  usedCrossSectional so the UI can say so). */
const MIN_OWN_HISTORY = 8;
const HISTORY_SPAN_MS = 7 * 24 * 60 * 60_000;

const SCREENER_BATCH = 5; // token-screener accepts at most 5 chains per call
const PER_PAGE = 1000;
const MAX_TRADE_PAGES = 3;

interface ChainWindowInput {
  chain: string;
  window: Window;
  netFlowUsd: number;
  volumeUsd: number;
  tokenCount: number;
  source: PressureSource;
}

interface ScreenerRow {
  chain: string; token_address?: string | null; token_symbol?: string | null; volume?: number | null; netflow?: number | null; market_cap_usd?: number | null;
  buy_volume?: number | null; sell_volume?: number | null; price_usd?: number | null; price_change?: number | null; liquidity?: number | null; token_age_days?: number | null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function lastSnapshotAt(window: Window): number | null {
  const row = getDb()
    .prepare('SELECT MAX(snapshot_at) AS t FROM chain_pressure_snapshots WHERE window = ?')
    .get(window) as { t: number | null };
  return row.t;
}

function dueWindows(now: number): Window[] {
  return WINDOWS.filter((w) => {
    const last = lastSnapshotAt(w);
    return last === null || now - last >= WINDOW_CADENCE_MS[w];
  });
}

/** Orders chains by last known 24h volume so each screener batch groups
 *  chains of similar size. A 1000-row page sorted by volume across five
 *  chains is dominated by the largest one; batching a small chain with
 *  Ethereum would cut its long tail and understate its volume. The first
 *  ever run has no history and falls back to registry order. */
function orderBySize(chains: string[]): string[] {
  const rows = getDb().prepare(`
    SELECT chain, volume_usd FROM chain_pressure_snapshots
    WHERE window = '24h' AND id IN (SELECT MAX(id) FROM chain_pressure_snapshots WHERE window = '24h' GROUP BY chain)
  `).all() as Array<{ chain: string; volume_usd: number }>;
  const size = new Map(rows.map((r) => [r.chain, r.volume_usd]));
  return [...chains].sort((a, b) => (size.get(b) ?? -1) - (size.get(a) ?? -1));
}

/** The exact token-screener body the scanner sends — exported so the ⓘ
 *  provenance shows the real request, not a paraphrase of it. */
export function screenerRequestBody(chains: string[], window: Window, smartMoneyOnly: boolean) {
  return {
    chains,
    timeframe: window,
    pagination: { page: 1, per_page: PER_PAGE },
    // Ordered by volume so that if a batch has more than PER_PAGE tokens,
    // what gets cut is the long tail of the smallest ones.
    order_by: [{ field: 'volume', direction: 'DESC' }],
    // Risk assets only: stablecoin and native-token volume would swamp
    // both sides of the ratio with flows that are cash management, not a
    // view on the chain. Identical filters on the numerator and
    // denominator calls, so ratio = netflow / volume divides like by like.
    filters: {
      include_stablecoins: false,
      include_native_tokens: false,
      ...(smartMoneyOnly ? { trader_type: 'sm' } : {}),
    },
  };
}

export const DEX_TRADES_REQUEST = { chains: ['all'], pagination: { page: 1, per_page: PER_PAGE }, order_by: [{ field: 'block_timestamp', direction: 'DESC' }] };

async function fetchScreener(chains: string[], window: Window, smartMoneyOnly: boolean): Promise<ScreenerRow[]> {
  const r = await callNansen<{ data: ScreenerRow[] }>(
    'token-screener',
    screenerRequestBody(chains, window, smartMoneyOnly),
    { skipCache: true, record: false },
  );
  return r.data.data ?? [];
}

function sumByChain(rows: ScreenerRow[], field: 'volume' | 'netflow'): Map<string, { sum: number; count: number }> {
  const out = new Map<string, { sum: number; count: number }>();
  for (const row of rows) {
    // Belt and braces: the request already excludes stablecoins, but
    // Nansen's flag misses some non-EVM stables (Sui's SBUSDT/USDSUI), and
    // a stable swap pair would otherwise read as a $280K flow each way.
    if (isStablecoin(row.token_symbol)) continue;
    const v = row[field];
    if (v == null || !Number.isFinite(v)) continue;
    const acc = out.get(row.chain) ?? { sum: 0, count: 0 };
    acc.sum += v;
    acc.count += 1;
    out.set(row.chain, acc);
  }
  return out;
}

const EMPTY = { sum: 0, count: 0 };

interface WindowRows { market: ScreenerRow[]; sm: ScreenerRow[] | null }

async function gatherInputs(windows: Window[], errors: string[]): Promise<{ inputs: ChainWindowInput[]; candidates: SweepCandidate[]; rows: Map<Window, WindowRows> }> {
  const chains = orderBySize(pressureChains());
  const smChains = chains.filter((c) => pressureSource(c) === 'smart-money');
  const inputs: ChainWindowInput[] = [];
  // Token rows from the 24h smart-money pass, kept for the storm sweep —
  // the scanner already paid for them.
  const candidates: SweepCandidate[] = [];
  // Every row fetched, per window, for the sector aggregates (no extra calls).
  const rowsByWindow = new Map<Window, WindowRows>();

  for (const w of windows) {
    const windowRows: WindowRows = { market: [], sm: smChains.length ? [] : null };
    rowsByWindow.set(w, windowRows);
    // All-trader volume and netflow for every pressure chain, one call per
    // batch — the same rows serve as every chain's denominator and as the
    // market-flow numerator for chains with no trader labels.
    const volume = new Map<string, { sum: number; count: number }>();
    const marketFlow = new Map<string, { sum: number; count: number }>();
    for (const batch of chunk(chains, SCREENER_BATCH)) {
      try {
        const rows = await fetchScreener(batch, w, false);
        windowRows.market.push(...rows);
        for (const [chain, acc] of sumByChain(rows, 'volume')) volume.set(chain, acc);
        for (const [chain, acc] of sumByChain(rows, 'netflow')) marketFlow.set(chain, acc);
      } catch (e) {
        errors.push(`token-screener ${w} [${batch.join(',')}]: ${(e as Error).message.slice(0, 160)}`);
      }
    }

    // Smart-money net flow for Tier A. A chain whose batch was queried
    // successfully but came back with no rows is a real observation —
    // smart money didn't trade there this window — and is recorded as zero
    // flow across zero tokens. A chain whose batch FAILED is skipped: an
    // error is not evidence of zero flow.
    const smFlow = new Map<string, { sum: number; count: number }>();
    const smQueried = new Set<string>();
    for (const batch of chunk(smChains, SCREENER_BATCH)) {
      try {
        const rows = await fetchScreener(batch, w, true);
        windowRows.sm?.push(...rows);
        for (const [chain, acc] of sumByChain(rows, 'netflow')) smFlow.set(chain, acc);
        if (w === '24h') {
          for (const r of rows) {
            if (r.token_address && r.netflow != null) {
              candidates.push({ chain: r.chain, tokenAddress: r.token_address, symbol: r.token_symbol ?? null, netFlowUsd: r.netflow, marketCapUsd: r.market_cap_usd ?? null });
            }
          }
        }
        for (const chain of batch) smQueried.add(chain);
      } catch (e) {
        errors.push(`token-screener sm ${w} [${batch.join(',')}]: ${(e as Error).message.slice(0, 160)}`);
      }
    }

    for (const chain of chains) {
      const vol = volume.get(chain);
      if (!vol) continue; // no volume observed — no ratio, so no snapshot (never a made-up zero)
      // Every chain gets an all-trader (market-flow) reading from rows the
      // scanner already paid for: it is the pressure public views may show.
      const mf = marketFlow.get(chain) ?? EMPTY;
      inputs.push({ chain, window: w, netFlowUsd: mf.sum, volumeUsd: vol.sum, tokenCount: mf.count, source: 'market-flow' });
      // Tier A chains also get the smart-money reading (private views).
      if (pressureSource(chain) === 'smart-money' && smQueried.has(chain)) {
        const sm = smFlow.get(chain) ?? EMPTY;
        inputs.push({ chain, window: w, netFlowUsd: sm.sum, volumeUsd: vol.sum, tokenCount: sm.count, source: 'smart-money' });
      }
    }
  }
  return { inputs, candidates, rows: rowsByWindow };
}

/** This chain's ratios for this window strictly before `at`, within the
 *  trailing history span — strictly before so a rescore of an old snapshot
 *  never sees its own value or anything later. */
function ownHistory(chain: string, window: Window, source: PressureSource, at: number): number[] {
  const rows = getDb()
    .prepare('SELECT ratio FROM chain_pressure_snapshots WHERE chain = ? AND window = ? AND nf_source = ? AND snapshot_at < ? AND snapshot_at >= ? ORDER BY snapshot_at')
    .all(chain, window, source, at, at - HISTORY_SPAN_MS) as Array<{ ratio: number }>;
  return rows.map((r) => r.ratio);
}

/**
 * Scores one scan's inputs. Peers are grouped by window AND source: a
 * smart-money ratio and a market-flow ratio measure different things, and
 * z-scoring one against a sample of the other would compare apples to
 * oranges. Shared by live scans and by rescoreAll, so a stored snapshot is
 * always reproducible from its stored raw inputs by the exact same code.
 */
function scoreInputs(inputs: ChainWindowInput[], at: number): Array<{ input: ChainWindowInput; result: CpiWindowResult }> {
  const groups = new Map<string, ChainWindowInput[]>();
  for (const i of inputs) {
    const key = `${i.window}|${i.source}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  const out: Array<{ input: ChainWindowInput; result: CpiWindowResult }> = [];
  for (const list of groups.values()) {
    const window = list[0].window;
    // Peers' current ratios: the fallback sample for any chain that
    // doesn't yet have MIN_OWN_HISTORY snapshots of its own.
    const peerRatios = list.map((i) => flowRatio({ netFlowUsd: i.netFlowUsd, volumeUsd: i.volumeUsd }));
    for (const input of list) {
      const history = ownHistory(input.chain, window, input.source, at);
      // Own history is only a usable baseline if it has some spread: a
      // chain whose ratio has sat at exactly zero for days would score any
      // new move as z = 0, which is backwards — that move is exactly the
      // unusual thing. Peers are the fallback in both cases.
      const usable = history.length >= MIN_OWN_HISTORY && new Set(history).size > 1;
      const result = chainPressureWindow(
        { netFlowUsd: input.netFlowUsd, volumeUsd: input.volumeUsd },
        window,
        usable ? history : [],
        peerRatios,
      );
      out.push({ input, result });
    }
  }
  return out;
}

function scoreAndStore(inputs: ChainWindowInput[], now: number): void {
  const db = getDb();
  const insert = db.prepare(`
    INSERT INTO chain_pressure_snapshots
      (chain, window, net_flow_usd, volume_usd, ratio, z, cpi, used_cross_section, nf_source, token_count, snapshot_at)
    VALUES (@chain, @window, @netFlowUsd, @volumeUsd, @ratio, @z, @cpi, @usedCross, @source, @tokenCount, @now)
  `);
  const scored = scoreInputs(inputs, now);
  db.transaction(() => {
    for (const { input, result } of scored) {
      insert.run({ ...input, ratio: result.ratio, z: result.z, cpi: result.cpi, usedCross: result.usedCrossSectional ? 1 : 0, now });
    }
  })();
}

/**
 * Recomputes every stored snapshot's z and CPI from its stored raw inputs
 * (net flow, volume), oldest scan first, then rebuilds the blended series.
 * Zero credits. Used after a model change so history is scored by the
 * current formula rather than a mix of old and new — the stored inputs are
 * the source of truth; z and CPI are derived columns.
 */
export function rescoreAll(): { snapshots: number; blended: number } {
  const db = getDb();
  const times = (db.prepare('SELECT DISTINCT snapshot_at AS t FROM chain_pressure_snapshots ORDER BY t').all() as Array<{ t: number }>).map((r) => r.t);
  const update = db.prepare('UPDATE chain_pressure_snapshots SET ratio = ?, z = ?, cpi = ?, used_cross_section = ? WHERE id = ?');
  let snapshots = 0;
  let blended = 0;
  db.transaction(() => {
    db.prepare('DELETE FROM chain_cpi').run();
    for (const at of times) {
      const rows = db.prepare('SELECT * FROM chain_pressure_snapshots WHERE snapshot_at = ?').all(at) as Array<{
        id: number; chain: string; window: Window; net_flow_usd: number; volume_usd: number; token_count: number; nf_source: PressureSource;
      }>;
      const inputs: Array<ChainWindowInput & { id: number }> = rows.map((r) => ({
        id: r.id, chain: r.chain, window: r.window, netFlowUsd: r.net_flow_usd, volumeUsd: r.volume_usd,
        tokenCount: r.token_count, source: r.nf_source,
      }));
      for (const { input, result } of scoreInputs(inputs, at)) {
        update.run(result.ratio, result.z, result.cpi, result.usedCrossSectional ? 1 : 0, (input as ChainWindowInput & { id: number }).id);
        snapshots++;
      }
      blended += storeBlended(at);
    }
  })();
  return { snapshots, blended };
}

/** Blends each chain's latest CPI per window, as of `now`, into one
 *  reading and appends it to the chain_cpi series. Windows refresh on
 *  different cadences, so "latest" can mean this run for 1h and a few
 *  hours ago for 7d — that's the intended reuse, not staleness to hide. */
function storeBlended(now: number): number {
  const db = getDb();
  const latest = db.prepare(`
    SELECT s.chain, s.window, s.nf_source, s.ratio, s.z, s.cpi, s.used_cross_section
    FROM chain_pressure_snapshots s
    JOIN (
      SELECT chain, window, nf_source, MAX(id) AS id FROM chain_pressure_snapshots
      WHERE snapshot_at <= ? GROUP BY chain, window, nf_source
    ) m ON m.id = s.id
  `).all(now) as Array<{ chain: string; window: Window; nf_source: PressureSource; ratio: number; z: number; cpi: number; used_cross_section: number }>;

  // One blended reading per chain and per source.
  const byKey = new Map<string, { chain: string; source: PressureSource; windows: Partial<Record<Window, CpiWindowResult>> }>();
  for (const row of latest) {
    const key = `${row.chain}|${row.nf_source}`;
    const entry = byKey.get(key) ?? { chain: row.chain, source: row.nf_source, windows: {} };
    entry.windows[row.window] = { window: row.window, ratio: row.ratio, z: row.z, cpi: row.cpi, usedCrossSectional: row.used_cross_section === 1 };
    byKey.set(key, entry);
  }

  const insert = db.prepare('INSERT INTO chain_cpi (chain, cpi, any_cross_section, windows, snapshot_at, source) VALUES (?, ?, ?, ?, ?, ?)');
  let n = 0;
  db.transaction(() => {
    for (const { chain, source, windows } of byKey.values()) {
      const blended = blendChainPressure(windows);
      insert.run(chain, blended.cpi, blended.anyCrossSectional ? 1 : 0, JSON.stringify(Object.keys(blended.byWindow)), now, source);
      n++;
    }
  })();
  return n;
}

/** Nansen returns block_timestamp without a zone suffix; it's UTC. */
function parseTimestamp(ts: string): number {
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? ts : `${ts}Z`);
}

async function captureTrades(now: number, errors: string[]): Promise<number> {
  const db = getDb();
  const newest = (db.prepare('SELECT MAX(traded_at) AS t FROM smart_money_trades').get() as { t: number | null }).t ?? 0;
  const insert = db.prepare(`
    INSERT OR IGNORE INTO smart_money_trades
      (chain, tx_hash, wallet, wallet_label, side, token_address, token_symbol, usd_value, traded_at, captured_at)
    VALUES (@chain, @tx, @wallet, @label, @side, @token, @symbol, @usd, @at, @now)
  `);

  let added = 0;
  for (let page = 1; page <= MAX_TRADE_PAGES; page++) {
    let rows: SmartMoneyDexTrade[];
    try {
      const r = await callNansen<{ data: SmartMoneyDexTrade[]; pagination: { is_last_page: boolean } }>(
        'smart-money/dex-trades',
        { chains: ['all'], pagination: { page, per_page: PER_PAGE }, order_by: [{ field: 'block_timestamp', direction: 'DESC' }] },
        { skipCache: true, record: false },
      );
      rows = r.data.data ?? [];
      db.transaction(() => {
        for (const t of rows) {
          const side = classifySwap(t);
          if (!side || !t.trader_address || !t.transaction_hash || t.trade_value_usd == null) continue;
          const result = insert.run({
            // Base58 (Solana) is case-sensitive: only EVM hex is lowercased.
            chain: t.chain, tx: t.transaction_hash, wallet: addressKey(t.trader_address),
            label: t.trader_address_label ?? null, side: side.side, token: addressKey(side.tokenAddress),
            symbol: side.tokenSymbol, usd: Math.abs(t.trade_value_usd), at: parseTimestamp(t.block_timestamp), now,
          });
          added += result.changes;
        }
      })();
      if (r.data.pagination?.is_last_page !== false) break;
    } catch (e) {
      errors.push(`smart-money/dex-trades page ${page}: ${(e as Error).message.slice(0, 160)}`);
      break;
    }
    // Pages are newest-first: once a page reaches trades already stored,
    // every later page is older still, so stop paying for them.
    const oldestOnPage = Math.min(...rows.map((t) => parseTimestamp(t.block_timestamp)));
    if (oldestOnPage <= newest) break;
  }
  return added;
}

const PULSE_PER_CHAIN = 25;
const PULSE_KEEP_MS = 7 * 24 * 3_600_000;

/** Keeps the busiest tokens per chain from rows this scan already fetched
 *  (see migration 13). Stablecoins are skipped, as everywhere else. */
function storeTokenPulse(at: number, window: '1h' | '24h', market: ScreenerRow[], sm: ScreenerRow[] | null): number {
  const db = getDb();
  const ins = db.prepare(`INSERT OR IGNORE INTO token_pulse
    (snapshot_at, window, source, chain, token_address, symbol, netflow, volume, buy_volume, sell_volume, price_usd, price_change, liquidity, market_cap, age_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const fin = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? v : null);
  let n = 0;
  const put = (source: string, rows: ScreenerRow[], perChain: number) => {
    const byChain = new Map<string, ScreenerRow[]>();
    for (const r of rows) {
      if (!r.token_address || isStablecoin(r.token_symbol)) continue;
      const list = byChain.get(r.chain);
      if (list) list.push(r); else byChain.set(r.chain, [r]);
    }
    for (const list of byChain.values()) {
      for (const r of [...list].sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0)).slice(0, perChain)) {
        ins.run(at, window, source, r.chain, addressKey(r.token_address!), r.token_symbol ?? null,
          fin(r.netflow), fin(r.volume), fin(r.buy_volume), fin(r.sell_volume), fin(r.price_usd), fin(r.price_change), fin(r.liquidity), fin(r.market_cap_usd), fin(r.token_age_days));
        n++;
      }
    }
  };
  db.transaction(() => {
    put('market-flow', market, PULSE_PER_CHAIN);
    if (sm) put('smart-money', sm, PULSE_PER_CHAIN);
    db.prepare('DELETE FROM token_pulse WHERE snapshot_at < ?').run(at - PULSE_KEEP_MS);
  })();
  return n;
}

export interface ScanSummary {
  windows: Window[];
  chainsScored: number;
  tradesAdded: number;
  stormsScored: number;
  /** With `sweep: 'defer'`: the sweep's candidates when one is due, for
   *  the caller to run as its own job. */
  sweepCandidates: SweepCandidate[] | null;
  /** Sector aggregate rows written (0 until sector membership exists). */
  sectorRows: number;
  credits: number;
  errors: string[];
  ms: number;
}

/** One scan. The storm sweep (when due) runs inline by default; the worker
 *  passes `sweep: 'defer'` and queues it as a separate job, so a sweep
 *  failure retries on its own without re-running the scan. */
export async function runScan(opts: { sweep?: 'inline' | 'defer' } = {}): Promise<ScanSummary> {
  const db = getDb();
  const started = Date.now();
  const runId = db.prepare('INSERT INTO scan_runs (started_at) VALUES (?)').run(started).lastInsertRowid;
  const errors: string[] = [];

  const windows = dueWindows(started);
  const { inputs, candidates, rows } = await gatherInputs(windows, errors);
  scoreAndStore(inputs, started);
  let sectorRows = 0;
  for (const [w, r] of rows) {
    try { sectorRows += storeSectorSnapshots(started, w, r.market, r.sm); } catch (e) { errors.push(`sector snapshots ${w}: ${(e as Error).message.slice(0, 120)}`); }
    if (w === '1h' || w === '24h') {
      try { storeTokenPulse(started, w, r.market, r.sm); } catch (e) { errors.push(`token pulse ${w}: ${(e as Error).message.slice(0, 120)}`); }
    }
  }
  const chainsScored = storeBlended(started);
  const tradesAdded = await captureTrades(started, errors);
  const due = candidates.length > 0 && sweepDue(started);
  const deferSweep = opts.sweep === 'defer';
  const stormsScored = due && !deferSweep ? await stormSweep(candidates, errors) : 0;

  const credits = (db.prepare('SELECT COALESCE(SUM(credits), 0) AS c FROM credit_ledger WHERE called_at >= ?').get(started) as { c: number }).c;
  const finished = Date.now();
  db.prepare('UPDATE scan_runs SET finished_at = ?, chains_scored = ?, trades_added = ?, credits = ?, error = ? WHERE id = ?')
    .run(finished, chainsScored, tradesAdded, credits, errors.length ? errors.join(' | ') : null, runId);

  return { windows, chainsScored, tradesAdded, stormsScored, sweepCandidates: due && deferSweep ? candidates : null, sectorRows, credits, errors, ms: finished - started };
}
