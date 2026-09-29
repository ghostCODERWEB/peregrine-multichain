// Exports the real data behind the README charts into docs/readme/data/ (run: pnpm tsx scripts/readme-assets/export-data.ts).
// Sources: fixtures/proof-ledger.json (Nansen API ledger), fixtures/backtest-results.json (out-of-sample model test),
// docs/openapi.json (Nansen's published API), src/types/nansen/chain-enums.ts (per-endpoint chain support).
import fs from 'node:fs';
import { ALL_CHAIN_IDS } from '../../src/lib/registry';
import { CHAIN_ENUMS } from '../../src/types/nansen/chain-enums';
import { RUG_CHAINS } from '../../src/lib/rug';

const out = (name: string, data: unknown) => fs.writeFileSync(`docs/readme/data/${name}.json`, JSON.stringify(data, null, 1));
const ledger = JSON.parse(fs.readFileSync('fixtures/proof-ledger.json', 'utf8'));
out('ledger', ledger);

const bt = JSON.parse(fs.readFileSync('fixtures/backtest-results.json', 'utf8'));
type Roc = Array<[number, number]>;
type ModelResult = { definition: unknown; train: unknown; test: unknown; passes: unknown; fitted: { auc: number; aucCi: unknown; brier: number; roc: Roc; weights: unknown }; expert: { auc: number; roc: Roc } };
const pick = (m: ModelResult | undefined) => m && ({ definition: m.definition, train: m.train, test: m.test, fitted: { auc: m.fitted.auc, aucCi: m.fitted.aucCi, brier: m.fitted.brier, roc: m.fitted.roc, weights: m.fitted.weights }, expert: { auc: m.expert.auc, roc: m.expert.roc }, passes: m.passes });
out('backtest', { generatedAt: bt.generatedAt, samples: bt.samples, tokens: bt.tokens, anchors: bt.anchors, chains: bt.chains, storm: pick(bt.storm), breakout: pick(bt.breakout), cone: bt.cone });

// Nansen API coverage: documented endpoints (docs/openapi.json) vs endpoints Peregrine called (ledger).
const norm = (p: string) => p.replace(/^\/+|\/+$/g, '').replace(/^(api\/)?(v1beta1|v1|beta)\//, '');
const spec = JSON.parse(fs.readFileSync('docs/openapi.json', 'utf8'));
const documented = [...new Set(Object.keys(spec.paths).map(norm))].sort();
const calls: Record<string, number> = {};
for (const e of ledger.endpoints) calls[norm(e.endpoint)] = (calls[norm(e.endpoint)] ?? 0) + e.calls;
const used = Object.keys(calls).sort();
const fam = (p: string) => p.split('/')[0];
const families = [...new Set(documented.map(fam))].map((f) => ({ family: f, documented: documented.filter((p) => fam(p) === f).length, used: documented.filter((p) => fam(p) === f && calls[p]).length }));
out('coverage', { endpoints: documented, documented: documented.length, covered: documented.filter((p) => calls[p]).length, unused: documented.filter((p) => !calls[p]), beyondDocs: used.filter((p) => !documented.includes(p)), families, calls });

// Chain support per Nansen endpoint (Nansen's own chain enums), and the chains Peregrine covers.
const enumSupport: Record<string, string[]> = {};
for (const [k, v] of Object.entries(CHAIN_ENUMS)) enumSupport[k] = [...(v as readonly string[])];
out('chains', { chains: [...ALL_CHAIN_IDS], tokenCheckerNetworks: [...RUG_CHAINS], endpoints: enumSupport });
console.log('exported: ledger, backtest, coverage, chains');
