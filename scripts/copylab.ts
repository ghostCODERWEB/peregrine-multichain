// `pnpm tsx scripts/copylab.ts`: compute Copy Lab now (Nansen candles for the most-bought tokens) and store it.
import { config } from 'dotenv'; config({ path: '.env.local' });
process.env.FIXTURE_RECORD = '0'; // never overwrite test fixtures from a script run
(async () => {
  // Imported after the env is set: static imports would load the Nansen client first.
  const { computeCopyLab } = await import('@/server/copy/followability');
  const t = Date.now();
  const r = await computeCopyLab();
  console.log(`buys measured ${r.buysMeasured} · wallets ${r.walletsScored} · tokens priced ${r.tokensPriced}/${r.calls} calls · ${Math.round((Date.now() - t) / 1000)}s`);
  console.log('decay mean', r.decay.mean.map((x) => (x * 100).toFixed(1) + '%').join(' → '), '· win', r.decay.win.map((x) => Math.round(x * 100) + '%').join(' → '));
  for (const w of r.wallets.slice(0, 8)) console.log(w.score, (w.label ?? w.wallet).slice(0, 34).padEnd(34), 'tok', w.tokens, 'n', w.buys, 'med1h', (w.median[2] * 100).toFixed(1) + '%', 'win1h', Math.round(w.win[2] * 100) + '%', 'mean0', (w.mean[0] * 100).toFixed(1) + '%');
})();
