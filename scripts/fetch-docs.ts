// `pnpm fetch-docs`: Step 0 of the superapp build. Fetches Nansen's
// llms.txt and every page it lists (as markdown), saves them under
// docs/raw/, and merges the OpenAPI 3.1 spec embedded in each endpoint page
// into one docs/openapi.json — the machine-readable source the contract,
// the Zod schemas and the endpoint ledger are generated from. Docs pages
// only; no API calls, no credits.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'https://docs.nansen.ai';
const RAW = path.resolve('docs/raw');

interface OpenApi {
  openapi?: string;
  security?: Array<Record<string, unknown>>;
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, unknown>; [k: string]: unknown };
}

const slug = (p: string) => p.replace(/^\//, '').replace(/\.md$/, '').replace(/\//g, '__') + '.md';

async function get(url: string, tries = 3): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (r.ok) return await r.text();
      if (r.status === 404) return null;
    } catch { /* retry */ }
    await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  return null;
}

function extractSpecs(md: string): OpenApi[] {
  const out: OpenApi[] = [];
  for (const m of md.matchAll(/```json\n([\s\S]*?)\n```/g)) {
    if (!m[1].includes('"openapi"')) continue;
    try { out.push(JSON.parse(m[1]) as OpenApi); } catch { /* malformed block: skip, logged below */ }
  }
  return out;
}

async function main() {
  fs.mkdirSync(RAW, { recursive: true });
  const index = await get(`${ROOT}/llms.txt`);
  if (!index) throw new Error('could not fetch llms.txt');
  fs.writeFileSync(path.join(RAW, '_llms.txt'), index);
  const pages = [...new Set([...index.matchAll(/\((?:https:\/\/docs\.nansen\.ai)?(\/[^)\s]+\.md)\)/g)].map((m) => m[1]))];
  console.log(`llms.txt lists ${pages.length} pages`);

  const merged: Required<Pick<OpenApi, 'paths'>> & { components: { schemas: Record<string, unknown> } } = { paths: {}, components: { schemas: {} } };
  const pageOf: Record<string, string> = {};
  const collisions: string[] = [];
  let fetched = 0, specs = 0;
  // Politeness: a few pages at a time.
  for (let i = 0; i < pages.length; i += 6) {
    await Promise.all(pages.slice(i, i + 6).map(async (p) => {
      const md = await get(`${ROOT}${p}`);
      if (!md) { console.warn(`  missing ${p}`); return; }
      fetched++;
      fs.writeFileSync(path.join(RAW, slug(p)), md);
      for (const spec of extractSpecs(md)) {
        specs++;
        // Payment schemes (apikey / x402 / MPP) are declared per page, not
        // per operation: carry them onto each operation as x-security.
        const pageSecurity = (spec.security ?? []).flatMap((x) => Object.keys(x));
        for (const [route, ops] of Object.entries(spec.paths ?? {})) {
          const withSec = Object.fromEntries(Object.entries(ops).map(([m, op]) => [m, op && typeof op === 'object'
            ? { ...(op as Record<string, unknown>), 'x-security': ((op as { security?: Array<Record<string, unknown>> }).security ?? []).flatMap((x) => Object.keys(x)).concat(pageSecurity).filter((v, i, a) => a.indexOf(v) === i) }
            : op]));
          merged.paths[route] = { ...(merged.paths[route] ?? {}), ...withSec };
          pageOf[route] = p;
        }
        for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
          const prev = merged.components.schemas[name];
          if (prev && JSON.stringify(prev) !== JSON.stringify(schema)) {
            // Same name, different shape on another page: keep both, suffix the newcomer.
            const alt = `${name}__${slug(p).replace(/\.md$/, '').split('__').pop()}`;
            merged.components.schemas[alt] = schema;
            collisions.push(`${name} (${p} → ${alt})`);
          } else merged.components.schemas[name] = schema;
        }
      }
    }));
  }
  const out = { openapi: '3.1.0', info: { title: 'Nansen API (merged from docs.nansen.ai)', fetchedAt: new Date().toISOString() }, paths: merged.paths, components: merged.components, 'x-source-page': pageOf };
  fs.writeFileSync(path.resolve('docs/openapi.json'), JSON.stringify(out, null, 1));
  const ops = Object.values(merged.paths).reduce((n, o) => n + Object.keys(o).filter((k) => ['get', 'post', 'put', 'patch', 'delete'].includes(k)).length, 0);
  console.log(`fetched ${fetched}/${pages.length} pages · ${specs} embedded specs · ${Object.keys(merged.paths).length} paths · ${ops} operations · ${Object.keys(merged.components.schemas).length} schemas`);
  if (collisions.length) console.log(`schema name collisions (kept both): ${collisions.length}\n  ${collisions.slice(0, 15).join('\n  ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
