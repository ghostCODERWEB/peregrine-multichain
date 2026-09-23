// `pnpm sanitize-fixtures`: applies the fixture publication policy
// (src/server/nansen/fixture-policy.ts) to every file already in
// fixtures/ — drops prohibited/restricted recordings, strips labels — and
// filters the demo history export to public-view data. Idempotent.
import fs from 'node:fs';
import path from 'node:path';
import { publishableFixture } from '@/server/nansen/fixture-policy';
import { ALL_LEDGER } from '@/config/endpoint-ledger';
import { PUBLIC_DEMO_FILTERS } from '@/server/nansen/demo-history';

const DIR = path.resolve('fixtures');
const endpointOfSlug = new Map<string, string>();
for (const l of ALL_LEDGER) {
  const ep = l.key.split(' ')[1].replace(/^\/api\/v1\//, '').replace(/^\/api\/(v1beta1\/)/, '$1');
  endpointOfSlug.set(ep.replace(/\//g, '-'), ep);
}

let dropped = 0, kept = 0, removedFiles = 0;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.json'))) {
  const file = path.join(DIR, f);
  const slug = f.replace(/\.json$/, '');
  if (slug === 'backtest-results') continue;
  if (slug === 'scan-history') {
    const h = JSON.parse(fs.readFileSync(file, 'utf8')) as { exportedAt: number; tables: Record<string, { columns: string[]; rows: unknown[][] }> };
    for (const [name, t] of Object.entries(h.tables)) {
      const rule = PUBLIC_DEMO_FILTERS[name];
      if (!rule) { delete h.tables[name]; console.log(`scan-history: dropped table ${name}`); continue; }
      const before = t.rows.length;
      t.rows = t.rows.filter((r) => rule(Object.fromEntries(t.columns.map((c, i) => [c, r[i]]))));
      console.log(`scan-history: ${name} ${before} -> ${t.rows.length}`);
    }
    fs.writeFileSync(file, JSON.stringify(h));
    continue;
  }
  const endpoint = endpointOfSlug.get(slug);
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')) as Array<{ request: unknown; response: unknown }>;
  const out = entries.flatMap((e) => {
    const safe = endpoint ? publishableFixture(endpoint, e.request, e.response) : null;
    if (safe === null) { dropped++; return []; }
    kept++;
    return [{ ...e, response: safe }];
  });
  if (!out.length) { fs.unlinkSync(file); removedFiles++; console.log(`removed ${f} (nothing publishable)`); }
  else fs.writeFileSync(file, JSON.stringify(out, null, 2));
}
console.log(`kept ${kept} recordings, dropped ${dropped}, removed ${removedFiles} files`);
