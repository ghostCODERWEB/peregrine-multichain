// Bounded M3 live check and public-safe fixture recording. No paid labels,
// alerts, trading or signatures. Use a separate DB to keep the worker's
// concurrent spending out of this validation's ledger.
import { config } from 'dotenv';
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });
import { portfolio, portfolioStress } from '@/server/portfolio/portfolio';
import { walletDesk, type DeskSection } from '@/server/wallet/desk';
import { callScope } from '@/server/nansen/client';

async function main() {
  const cap = Number(process.env.M3_CREDIT_CAP ?? 60);
  if (!Number.isFinite(cap) || cap < 1 || cap > 400) throw new Error('M3_CREDIT_CAP must be 1–400.');
  const address = '0xcbb811f129782ef87e19dea9d3375045219bae00';
  let spent = 0;
  async function step(name: string, maximum: number, fn: () => Promise<unknown>) {
    if (spent + maximum > cap) throw new Error(`Refusing ${name}: would exceed ${cap} credits.`);
    const tally = { calls: 0, credits: 0, cached: 0 };
    try {
      const result = await callScope.run(tally, fn);
      console.log(name, JSON.stringify(result));
    } catch (e) { console.log(name, 'UNAVAILABLE', (e as Error).message); }
    // Nested portfolio scopes return their own cost; the conservative
    // reservation bounds the entire run even if a request partly fails.
    spent += maximum;
    console.log(`Reserved ${spent}/${cap}cr; outer scope observed ${tally.credits}cr.`);
  }
  await step('portfolio', 1, async () => { const p = await portfolio([address]); return { wallets: p.wallets.length, positions: p.positions.length, tally: p.tally }; });
  for (const section of ['pnl', 'dex', 'history', 'defi', 'perps', 'prediction'] as DeskSection[]) {
    await step(section, section === 'perps' ? 7 : section === 'history' ? 5 : section === 'prediction' ? 2 : 1, async () => { const r = await walletDesk(address, 'base', section); return { title: r.title, rows: r.tables.map((t) => [t.title, t.rows.length]), notes: r.provenance.notes }; });
  }
  await step('stress', 9, async () => { const r = await portfolioStress([address]); return { summary: r.summary, missing: r.missing, tally: r.tally }; });
}
main().catch((e) => { console.error((e as Error).message); process.exitCode = 1; });
