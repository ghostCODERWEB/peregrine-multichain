// `pnpm validate-api`: Step 0's check. One live call per Nansen endpoint
// (chained where a call needs an id from another: market -> orderbook,
// coin -> positions -> trader), each validated against the generated Zod
// schema. Writes docs/api-validation.md + .json: observed credit cost,
// rows, schema drift, and fields the docs don't list. Stops before
// VALIDATE_CREDIT_CAP (default 300). Nothing is recorded to fixtures.
//
// Skipped here on purpose: address labels (100/500 credits), agent/expert
// (750), and every write — alerts, trade prepare/execute. Those are
// validated inside their own modules.
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });
import fs from 'node:fs';
import { callNansen, type HttpMethod } from '@/server/nansen/client';
import { ENDPOINTS, type EndpointKey } from '@/types/nansen/api.gen';

const CAP = Number(process.env.VALIDATE_CREDIT_CAP ?? 300);
const day = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
const range = (from: number, to = 0) => ({ from: day(from), to: day(to) });
const page = (n = 5) => ({ page: 1, per_page: n });

// Known-good subjects from TIDE's own history.
const EVM_TOKEN = { chain: 'base', token_address: '0x9b5e262cf9bb04869ab40b19af91d2dc85761722' }; // NOCK
const SOL_TOKEN = { chain: 'solana', token_address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' }; // JUP
const WALLET = '0xcbb811f129782ef87e19dea9d3375045219bae00';

interface Result { key: string; ok: boolean; status: string; credits: number | null; rows: number | null; issues: string[]; unknownFields: string[]; ms: number }
const results: Result[] = [];
let spent = 0;

function rowsOf(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const d = (data as Record<string, unknown>).data;
    if (Array.isArray(d)) return d;
    for (const v of Object.values(data as Record<string, unknown>)) if (Array.isArray(v)) return v;
  }
  return null;
}

/** Top-level row keys the response has but the schema doesn't declare. */
function unknownKeys(key: EndpointKey, data: unknown): string[] {
  const rows = rowsOf(data);
  const sample = rows?.[0];
  if (!sample || typeof sample !== 'object') return [];
  const shape = (ENDPOINTS[key].response as unknown as { shape?: Record<string, unknown> }).shape;
  const dataField = shape?.data as { element?: { shape?: Record<string, unknown> } } | undefined;
  const declared = dataField?.element?.shape;
  if (!declared) return [];
  return Object.keys(sample as object).filter((k) => !(k in declared));
}

async function check(key: EndpointKey, body: Record<string, unknown> = {}): Promise<unknown> {
  const ep = ENDPOINTS[key];
  const cost = ep.credits ?? 5;
  if (spent + cost > CAP) { results.push({ key, ok: false, status: `skipped: cap ${CAP} reached`, credits: null, rows: null, issues: [], unknownFields: [], ms: 0 }); return null; }
  const t0 = Date.now();
  try {
    const r = await callNansen<unknown>(ep.endpoint, body, { method: ep.method as HttpMethod, record: false });
    spent += r.meta.creditsCost;
    const parsed = ep.response.safeParse(r.data);
    const issues = parsed.success ? [] : parsed.error.issues.slice(0, 6).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    const rows = rowsOf(r.data);
    results.push({ key, ok: parsed.success, status: r.meta.cacheHit ? 'ok (cache)' : 'ok', credits: r.meta.cacheHit ? null : r.meta.creditsCost, rows: rows?.length ?? null, issues, unknownFields: unknownKeys(key, r.data), ms: Date.now() - t0 });
    console.log(`${parsed.success ? '✓' : '≠'} ${key}  ${r.meta.creditsCost}cr  rows=${rows?.length ?? '-'}${issues.length ? `  drift: ${issues[0]}` : ''}`);
    return r.data;
  } catch (e) {
    const msg = (e as Error).message.slice(0, 220);
    results.push({ key, ok: false, status: `error: ${msg}`, credits: null, rows: null, issues: [], unknownFields: [], ms: Date.now() - t0 });
    console.log(`✗ ${key}  ${msg}`);
    return null;
  }
}

const pick = <T,>(data: unknown, f: (row: Record<string, unknown>) => T | undefined): T | undefined => {
  for (const r of rowsOf(data) ?? []) { const v = f(r as Record<string, unknown>); if (v != null && v !== '') return v; }
  return undefined;
};

async function main() {
  // Search, chains, account-free basics
  await check('POST /api/v1/search/general', { search_query: 'uniswap' });
  await check('POST /api/v1/search/entity-name', { search_query: 'binance' });
  await check('GET /api/v1/search/token-sectors');
  await check('POST /api/v1/chains/chain-rank', {});
  await check('POST /api/v1/token-screener', { chains: ['base'], timeframe: '24h', pagination: page() });

  // Token God Mode on an EVM token
  await check('POST /api/v1/tgm/token-information', { ...EVM_TOKEN, timeframe: '1d' });
  await check('POST /api/v1/tgm/indicators', EVM_TOKEN);
  await check('POST /api/v1/tgm/token-ohlcv', { ...EVM_TOKEN, timeframe: '1d', date: range(7) });
  await check('POST /api/v1/tgm/flow-intelligence', { ...EVM_TOKEN, timeframe: '1d' });
  await check('POST /api/v1/tgm/flows', { ...EVM_TOKEN, date: range(7), pagination: page() });
  await check('POST /api/v1/tgm/who-bought-sold', { ...EVM_TOKEN, date: range(7), pagination: page() });
  await check('POST /api/v1/tgm/holders', { ...EVM_TOKEN, pagination: page() });
  await check('POST /api/v1/tgm/transfers', { ...EVM_TOKEN, date: range(2), pagination: page() });
  const trades = await check('POST /api/v1/tgm/dex-trades', { ...EVM_TOKEN, date: range(1), pagination: page() });
  // Docs quirk: rejects `chain` (unknown field); the token address alone.
  await check('POST /api/v1/tgm/position-intelligence', { token_address: EVM_TOKEN.token_address });
  await check('POST /api/v1/tgm/pnl-leaderboard', { ...EVM_TOKEN, date: range(7), pagination: page() });
  await check('POST /api/v1/tgm/jup-dca', { token_address: SOL_TOKEN.token_address, pagination: page() });
  const txHash = pick(trades, (r) => r.transaction_hash as string | undefined);
  const txTime = pick(trades, (r) => r.block_timestamp as string | undefined);
  if (txHash) await check('POST /api/v1/transaction-with-token-transfer-lookup', { chain: EVM_TOKEN.chain, transaction_hash: txHash });

  // Smart money
  await check('POST /api/v1/smart-money/netflow', { chains: ['base'], pagination: page() });
  await check('POST /api/v1/smart-money/holdings', { chains: ['base'], pagination: page() });
  await check('POST /api/v1/smart-money/dex-trades', { chains: ['base'], pagination: page() });
  await check('POST /api/v1/smart-money/dcas', { pagination: page() });
  await check('POST /api/v1/smart-money/pnl-leaderboard', { chains: ['base'], pagination: page() });
  await check('POST /api/v1/smart-money/perp-trades', { pagination: page() });
  await check('POST /api/v1/smart-money/historical-holdings', { chains: ['base'], date_range: range(7), pagination: page() });

  // Profiler on a known wallet
  await check('POST /api/v1/profiler/address/current-balance', { address: WALLET, chain: 'all', pagination: page() });
  await check('POST /api/v1/profiler/address/historical-balances', { address: WALLET, chain: 'base', date: range(14), pagination: page() });
  await check('POST /api/v1/profiler/dex-trades', { address: WALLET, chain: 'base', date: range(7), pagination: page() });
  await check('POST /api/v1/profiler/address/transactions', { address: WALLET, chain: 'base', date: range(7), pagination: page() });
  await check('POST /api/v1/profiler/address/related-wallets', { address: WALLET, chain: 'base', pagination: page() });
  await check('POST /api/v1/profiler/address/first-funder', { address: WALLET });
  await check('POST /api/v1/profiler/address/pnl-summary', { address: WALLET, chain: 'all', date: range(30) });
  // Docs quirk: `date` is optional in the schema but required live.
  await check('POST /api/v1/profiler/address/pnl', { address: WALLET, chain: 'base', date: range(30), pagination: page() });
  await check('POST /api/v1/profiler/address/counterparties', { address: WALLET, chain: 'base', date: range(30), pagination: page() });
  await check('POST /api/v1/profiler/address/counterparties/batch', { wallet_addresses: [WALLET, '0xe61894033eec8ce33862f8c6b8c1aec56fd386e8'], chain: 'base', date: range(30), pagination: page() });
  await check('POST /api/v1/portfolio/defi-holdings', { wallet_address: WALLET });

  // Perps / Hyperliquid
  const perps = await check('POST /api/v1/perp-screener', { date: range(1), pagination: page() });
  const coin = pick(perps, (r) => r.token_symbol as string | undefined) ?? 'BTC';
  const pos = await check('POST /api/v1/tgm/perp-positions', { token_symbol: coin, pagination: page() });
  await check('POST /api/v1/tgm/perp-trades', { token_symbol: coin, date: range(1), pagination: page() });
  await check('POST /api/v1/tgm/perp-pnl-leaderboard', { token_symbol: coin, date: range(7), pagination: page() });
  const board = await check('POST /api/v1/perp-leaderboard', { date: range(7), pagination: page() });
  const trader = pick(pos, (r) => r.address as string | undefined) ?? pick(board, (r) => (r.trader_address ?? r.address) as string | undefined);
  if (trader) {
    await check('POST /api/v1/profiler/perp-positions', { address: trader });
    await check('POST /api/v1/profiler/perp-trades', { address: trader, date: range(7), pagination: page() });
    await check('POST /api/v1/profiler/perp-pnl-summary', { address: trader, date: range(30) });
  }

  // Prediction markets
  await check('POST /api/v1/prediction-market/categories', {});
  await check('POST /api/v1/prediction-market/event-screener', { pagination: page() });
  const markets = await check('POST /api/v1/prediction-market/market-screener', { pagination: page() });
  const marketId = pick(markets, (r) => (r.market_id ?? r.id) as string | undefined);
  if (marketId) {
    await check('POST /api/v1/prediction-market/orderbook', { market_id: marketId });
    await check('POST /api/v1/prediction-market/ohlcv', { market_id: marketId });
    const tbm = await check('POST /api/v1/prediction-market/trades-by-market', { market_id: marketId, pagination: page() });
    const holders = await check('POST /api/v1/prediction-market/top-holders', { market_id: marketId, pagination: page() });
    await check('POST /api/v1/prediction-market/pnl-by-market', { market_id: marketId, pagination: page() });
    await check('POST /api/v1/prediction-market/position-detail', { market_id: marketId, pagination: page() });
    const pmAddr = pick(holders, (r) => (r.address ?? r.owner_address ?? r.wallet_address) as string | undefined)
      ?? pick(tbm, (r) => (r.taker_address ?? r.maker_address ?? r.address) as string | undefined);
    if (pmAddr) {
      await check('POST /api/v1/prediction-market/address-summary', { address: pmAddr });
      await check('POST /api/v1/prediction-market/pnl-by-address', { address: pmAddr, pagination: page() });
      await check('POST /api/v1/prediction-market/trades-by-address', { address: pmAddr, pagination: page() });
    }
  }

  // Backtesting (v1beta1)
  const asOf = day(10);
  await check('POST /api/v1beta1/token-screener/historical', { to_date: asOf, timeframe_days: 7, chains: ['base'], pagination: page() });
  await check('POST /api/v1beta1/tgm/historical-token-ohlcv', { ...EVM_TOKEN, date_from: day(20), as_of_date: asOf, timeframe: '1d' });
  await check('POST /api/v1beta1/tgm/historical-token-flow-summary', { ...EVM_TOKEN, date_range: range(17, 10) });
  await check('POST /api/v1beta1/tgm/historical-dex-trades', { ...EVM_TOKEN, date_range: range(11, 10), pagination: page() });
  await check('POST /api/v1beta1/tgm/historical-who-bought-sold', { ...EVM_TOKEN, date_range: range(17, 10), pagination: page() });
  await check('POST /api/v1beta1/profiler/address/historical-token-balances', { address: WALLET, as_of_date: asOf, chain: 'base', pagination: page() });
  await check('POST /api/v1beta1/profiler/address/historical-transactions', { address: WALLET, chain: 'base', as_of_date: asOf, pagination: page() });
  // Live quirk: without block_timestamp the hash resolution times out.
  if (txHash) await check('POST /api/v1beta1/profiler/historical-transaction-lookup', { chain: EVM_TOKEN.chain, transaction_hash: txHash, as_of_date: day(0), ...(txTime ? { block_timestamp: txTime } : {}) });
  await check('POST /api/v1beta1/tgm/historical-top-holders', { ...EVM_TOKEN, as_of_date: asOf, pagination: page() });
  await check('POST /api/v1beta1/tgm/historical-token-quant-scores', { ...EVM_TOKEN, as_of_date: asOf });
  await check('POST /api/v1beta1/tgm/historical-pnl-leaderboard', { ...EVM_TOKEN, date_range: range(17, 10), pagination: page() });
  await check('POST /api/v1beta1/smart-money/historical-token-balances', { as_of_date: asOf, pagination: page() });

  // Account (0 credits, schema-less) and alerts list (0)
  try {
    const acct = await callNansen<unknown>('account', {}, { method: 'GET', skipCache: true, record: false });
    results.push({ key: 'GET /api/v1/account', ok: true, status: 'ok', credits: acct.meta.creditsCost, rows: null, issues: [], unknownFields: Object.keys(acct.data as object ?? {}), ms: 0 });
    console.log('✓ GET /api/v1/account', JSON.stringify(Object.keys(acct.data as object ?? {})));
  } catch (e) { console.log('✗ account', (e as Error).message.slice(0, 200)); }
  await check('GET /api/v1/smart-alert/list');

  const okN = results.filter((r) => r.ok).length;
  const drift = results.filter((r) => r.status.startsWith('ok') && !r.ok);
  const errors = results.filter((r) => r.status.startsWith('error'));
  fs.writeFileSync('docs/api-validation.json', JSON.stringify({ at: new Date().toISOString(), spent, cap: CAP, results }, null, 1));
  const md = [
    '# Live API validation (Step 0)', '',
    `Run ${new Date().toISOString().slice(0, 16)} UTC by \`pnpm validate-api\`: ${results.length} calls, **${okN} match their schema**, ${drift.length} drift, ${errors.length} errors, ${spent} credits (cap ${CAP}).`, '',
    '| Operation | Result | Credits | Rows | Drift / error | Undocumented fields |', '| --- | --- | --- | --- | --- | --- |',
    ...results.map((r) => `| \`${r.key}\` | ${r.ok ? '✓' : r.status.startsWith('ok') ? 'drift' : r.status.startsWith('skipped') ? 'skipped' : 'error'} | ${r.credits ?? '—'} | ${r.rows ?? '—'} | ${(r.issues.join('; ') || (r.status.startsWith('ok') ? '' : r.status)).replace(/\|/g, '/').slice(0, 200)} | ${r.unknownFields.slice(0, 8).join(', ')} |`),
  ];
  fs.writeFileSync('docs/api-validation.md', md.join('\n'));
  console.log(`\n${results.length} calls · ${okN} ok · ${drift.length} drift · ${errors.length} errors · ${spent} credits`);
}

main().catch((e) => { console.error(e); process.exit(1); });
