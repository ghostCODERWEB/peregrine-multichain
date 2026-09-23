// `pnpm gen-api`: generates src/types/nansen/api.gen.ts (a Zod schema for
// every component in docs/openapi.json, plus a typed ENDPOINTS registry)
// and docs/nansen-contract.md (the human-readable contract) from the
// merged spec that `pnpm fetch-docs` produced. Credits come from the docs'
// credit table; redistribution class and usage come from
// src/config/endpoint-ledger.ts, so the contract always states both.
//
// Schemas are deliberately tolerant — responses validate with safeParse
// and drift is logged, never thrown: every object is a looseObject
// (unknown fields pass through), non-required fields are nullish, integers
// are numbers, and length/range constraints are not enforced.
import fs from 'node:fs';
import path from 'node:path';
import { LEDGER, EXTRA_ENDPOINTS, type LedgerEntry } from '../src/config/endpoint-ledger';

type Schema = Record<string, unknown> & {
  $ref?: string; type?: string | string[]; properties?: Record<string, Schema>; required?: string[]; items?: Schema;
  anyOf?: Schema[]; oneOf?: Schema[]; allOf?: Schema[]; enum?: unknown[]; const?: unknown; additionalProperties?: boolean | Schema;
  description?: string; deprecated?: boolean;
};
interface Op {
  tags?: string[]; summary?: string; description?: string; deprecated?: boolean; 'x-security'?: string[];
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: Schema; description?: string }>;
  requestBody?: { content?: Record<string, { schema?: Schema }> };
  responses?: Record<string, { content?: Record<string, { schema?: Schema }> }>;
}

const spec = JSON.parse(fs.readFileSync('docs/openapi.json', 'utf8')) as {
  paths: Record<string, Record<string, Op>>; components: { schemas: Record<string, Schema> }; 'x-source-page': Record<string, string>;
  info: { fetchedAt: string };
};
const schemas = spec.components.schemas;
const ident = (name: string) => `S_${name.replace(/[^A-Za-z0-9_]/g, '_')}`;
const refName = (ref: string) => ref.replace('#/components/schemas/', '');

// ---- dependency order (refs first); cycles fall back to z.lazy ----
function refsOf(s: unknown, acc = new Set<string>()): Set<string> {
  if (!s || typeof s !== 'object') return acc;
  if (Array.isArray(s)) { s.forEach((x) => refsOf(x, acc)); return acc; }
  const o = s as Schema;
  if (typeof o.$ref === 'string') acc.add(refName(o.$ref));
  for (const [k, v] of Object.entries(o)) if (k !== '$ref' && typeof v === 'object') refsOf(v, acc);
  return acc;
}
const order: string[] = [];
const state = new Map<string, 'visiting' | 'done'>();
const cyclic = new Set<string>();
function visit(n: string) {
  if (state.get(n) === 'done') return;
  if (state.get(n) === 'visiting') { cyclic.add(n); return; }
  state.set(n, 'visiting');
  for (const d of refsOf(schemas[n])) if (schemas[d]) visit(d);
  state.set(n, 'done');
  order.push(n);
}
Object.keys(schemas).sort().forEach(visit);
const emitted = new Set<string>();

// ---- JSON Schema -> Zod expression ----
function zod(s: Schema | undefined, depth = 0): string {
  if (!s || typeof s !== 'object' || Object.keys(s).filter((k) => !['title', 'description', 'default', 'examples', 'example', 'deprecated'].includes(k)).length === 0) return 'z.unknown()';
  if (s.$ref) {
    const n = refName(s.$ref);
    if (!schemas[n]) return 'z.unknown()';
    return emitted.has(n) && !cyclic.has(n) ? ident(n) : `z.lazy((): z.ZodType<unknown> => ${ident(n)})`;
  }
  if (s.const !== undefined) return `z.literal(${JSON.stringify(s.const)})`;
  const alts = s.anyOf ?? s.oneOf;
  if (alts) {
    const nonNull = alts.filter((a) => !(a && a.type === 'null'));
    const nullable = nonNull.length !== alts.length;
    const inner = nonNull.length === 0 ? 'z.null()' : nonNull.length === 1 ? zod(nonNull[0], depth + 1) : `z.union([${nonNull.map((a) => zod(a, depth + 1)).join(', ')}])`;
    return nullable ? `${inner}.nullable()` : inner;
  }
  if (s.allOf) return s.allOf.map((a) => zod(a, depth + 1)).reduce((a, b) => `${a}.and(${b})`);
  if (Array.isArray(s.type)) {
    const nonNull = s.type.filter((t) => t !== 'null');
    const inner = nonNull.length === 1 ? zod({ ...s, type: nonNull[0] }, depth) : `z.union([${nonNull.map((t) => zod({ ...s, type: t }, depth)).join(', ')}])`;
    return s.type.includes('null') ? `${inner}.nullable()` : inner;
  }
  if (s.enum) {
    const vals = s.enum.filter((v) => v !== null);
    const base = vals.every((v) => typeof v === 'string') && vals.length
      ? `z.enum(${JSON.stringify(vals)})`
      : vals.length === 1 ? `z.literal(${JSON.stringify(vals[0])})` : `z.union([${vals.map((v) => `z.literal(${JSON.stringify(v)})`).join(', ')}])`;
    return s.enum.includes(null) ? `${base}.nullable()` : base;
  }
  switch (s.type) {
    case 'string': return 'z.string()';
    case 'number': case 'integer': return 'z.number()';
    case 'boolean': return 'z.boolean()';
    case 'null': return 'z.null()';
    case 'array': return `z.array(${zod(s.items, depth + 1)})`;
  }
  if (s.type === 'object' || s.properties || s.additionalProperties !== undefined) {
    const props = s.properties ?? {};
    if (!Object.keys(props).length) {
      const ap = s.additionalProperties;
      return `z.record(z.string(), ${ap && typeof ap === 'object' ? zod(ap, depth + 1) : 'z.unknown()'})`;
    }
    const req = new Set(s.required ?? []);
    const pad = '  '.repeat(depth + 1);
    const fields = Object.entries(props).map(([k, v]) => {
      const expr = zod(v, depth + 1);
      return `${pad}${JSON.stringify(k)}: ${req.has(k) ? expr : `${expr}.nullish()`},`;
    });
    return `z.looseObject({\n${fields.join('\n')}\n${'  '.repeat(depth)}})`;
  }
  return 'z.unknown()';
}

// ---- endpoints ----
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const creditTable = parseCredits();
interface Ep { key: string; method: string; path: string; endpoint: string; op: Op; req: string; res: string; chains: string[] | null; credits: number | null; security: string[] }
const endpoints: Ep[] = [];
for (const [p, ops] of Object.entries(spec.paths)) {
  for (const [m, op] of Object.entries(ops)) {
    if (!METHODS.includes(m) || !op || typeof op !== 'object') continue;
    const method = m.toUpperCase();
    const bodySchema = op.requestBody?.content?.['application/json']?.schema;
    let req = 'null';
    if (bodySchema) req = zod(bodySchema, 2);
    else if (op.parameters?.some((x) => x.in === 'query')) {
      const q: Schema = { type: 'object', properties: {}, required: [] };
      for (const prm of op.parameters.filter((x) => x.in === 'query')) {
        q.properties![prm.name] = prm.schema ?? {};
        if (prm.required) q.required!.push(prm.name);
      }
      req = zod(q, 2);
    }
    const ok = op.responses?.['200']?.content ?? op.responses?.['201']?.content;
    const resSchema = ok ? (ok['application/json']?.schema ?? Object.values(ok)[0]?.schema) : undefined;
    const res = resSchema ? zod(resSchema, 2) : 'z.unknown()';
    endpoints.push({
      key: `${method} ${p}`, method, path: p, endpoint: p.replace(/^\/api\/v1\//, '').replace(/^\/api\/(v1beta1\/)/, '$1'), op, req, res,
      chains: chainsOf(bodySchema), credits: creditTable.get(p) ?? null, security: op['x-security'] ?? [],
    });
  }
}
endpoints.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));

function deref(s: Schema | undefined): Schema | undefined {
  let cur = s;
  for (let i = 0; i < 5 && cur?.$ref; i++) cur = schemas[refName(cur.$ref)];
  return cur;
}
function enumOf(s: Schema | undefined): string[] | null {
  const d = deref(s);
  if (!d) return null;
  if (d.enum) return d.enum.filter((v): v is string => typeof v === 'string');
  for (const a of d.anyOf ?? d.oneOf ?? []) { const e = enumOf(a); if (e) return e; }
  if (d.type === 'array') return enumOf(d.items);
  return null;
}
function chainsOf(body: Schema | undefined): string[] | null {
  const d = deref(body);
  if (!d?.properties) return null;
  return enumOf(d.properties.chain) ?? enumOf(d.properties.chains) ?? null;
}

/** Parses the credit table in getting-started/credits.md into path -> credits (free plan). */
function parseCredits(): Map<string, number> {
  const out = new Map<string, number>();
  const md = fs.readFileSync('docs/raw/getting-started__credits.md', 'utf8');
  const rows = [...md.matchAll(/<tr><td[^>]*>([^<]+)(?:<sup>[^<]*<\/sup>)?[^<]*<\/td><td[^>]*>(\d+)<\/td><td[^>]*>(\d+)<\/td><\/tr>/g)];
  const all = Object.keys(spec.paths);
  for (const [, rawName, free] of rows) {
    const name = rawName.replace(/\(.*\)/, '').trim();
    const match = all.find((p) => p === `/api/v1/${name}` || p === `/api/v1beta1/${name}`);
    out.set(match ?? `/api/v1/${name}`, Number(free));
  }
  return out;
}

// ---- write api.gen.ts ----
const lines: string[] = [
  '// GENERATED by scripts/gen-api.ts from docs/openapi.json — do not edit by hand.',
  `// Source: docs.nansen.ai, fetched ${spec.info.fetchedAt}. Regenerate: pnpm fetch-docs && pnpm gen-api.`,
  '/* eslint-disable */',
  "import { z } from 'zod';",
  '',
];
for (const n of order) {
  const expr = zod(schemas[n], 0);
  emitted.add(n);
  const typed = cyclic.has(n) ? ': z.ZodType<unknown>' : '';
  lines.push(`export const ${ident(n)}${typed} = ${expr};`);
  if (!cyclic.has(n)) lines.push(`export type ${ident(n).slice(2)} = z.infer<typeof ${ident(n)}>;`);
}
lines.push('', 'export const ENDPOINTS = {');
for (const e of endpoints) {
  lines.push(`  ${JSON.stringify(e.key)}: {`,
    `    method: ${JSON.stringify(e.method)}, path: ${JSON.stringify(e.path)}, endpoint: ${JSON.stringify(e.endpoint)},`,
    `    tags: ${JSON.stringify(e.op.tags ?? [])}, security: ${JSON.stringify(e.security)}, credits: ${e.credits ?? 'null'},`,
    `    chains: ${e.chains ? JSON.stringify(e.chains) : 'null'}, deprecated: ${!!e.op.deprecated},`,
    `    request: ${e.req},`,
    `    response: ${e.res},`,
    '  },');
}
lines.push('} as const;', '', 'export type EndpointKey = keyof typeof ENDPOINTS;',
  'export type RequestOf<K extends EndpointKey> = (typeof ENDPOINTS)[K][\'request\'] extends z.ZodType ? z.input<(typeof ENDPOINTS)[K][\'request\']> : never;',
  'export type ResponseOf<K extends EndpointKey> = z.infer<(typeof ENDPOINTS)[K][\'response\']>;', '');
fs.writeFileSync('src/types/nansen/api.gen.ts', lines.join('\n'));

// ---- write the contract ----
const byKey = new Map<string, LedgerEntry>(LEDGER.map((l) => [l.key, l]));
// Live validation (pnpm validate-api), when present: observed cost and drift.
interface Validation { key: string; ok: boolean; status: string; credits: number | null; issues: string[] }
const live = new Map<string, Validation>();
if (fs.existsSync('docs/api-validation.json')) {
  for (const r of (JSON.parse(fs.readFileSync('docs/api-validation.json', 'utf8')) as { results: Validation[] }).results) live.set(r.key, r);
}
const liveCell = (k: string) => {
  const v = live.get(k);
  if (!v) return 'not run';
  if (v.ok) return 'ok';
  return v.status.startsWith('ok') ? `drift: ${v.issues[0] ?? ''}` : v.status.slice(0, 80);
};
const doc: string[] = [
  '# Nansen API contract',
  '',
  `Generated by \`pnpm gen-api\` from the OpenAPI specs embedded in docs.nansen.ai (fetched ${spec.info.fetchedAt.slice(0, 10)}), the docs' credit table, and \`src/config/endpoint-ledger.ts\` (redistribution class, usage). Do not edit by hand — edit the ledger or regenerate.`,
  '',
  `**${endpoints.length} operations with a published schema + ${EXTRA_ENDPOINTS.length} documented without one.** Payment schemes: \`ApiKeyAuth\` (header \`apikey\`), \`X402Payment\` (USDC on Base/Solana/Monad, header \`Payment-Signature\`), \`MppPayment\` (Tempo, \`Authorization: Payment\`).`,
  '',
  '| Operation | Credits | x402/MPP | Class | Chains | Live check | Used by |',
  '| --- | --- | --- | --- | --- | --- | --- |',
];
for (const e of endpoints) {
  const l = byKey.get(e.key);
  const observed = live.get(e.key)?.credits;
  const credits = e.credits ?? (observed != null ? `${observed} (observed)` : '—');
  doc.push(`| \`${e.key}\` | ${credits} | ${e.security.includes('X402Payment') ? 'yes' : 'no'} | ${l?.class ?? '**unclassified**'} | ${e.chains ? e.chains.length : '—'} | ${liveCell(e.key).replace(/\|/g, '/')} | ${l?.usedBy?.join(', ') || (l?.planned ? `planned ${l.planned}` : l?.skipped ? `skipped: ${l.skipped}` : '**unassigned**')} |`);
}
doc.push('', '## Documented without a published schema', '', '| Operation | Credits | Class | Notes |', '| --- | --- | --- | --- |');
for (const x of EXTRA_ENDPOINTS) doc.push(`| \`${x.key}\` | ${x.credits ?? '—'} | ${x.class} | ${x.notes} |`);
doc.push('', '## Live quirks (docs vs reality)', '',
  '- `tgm/position-intelligence` rejects `chain` (422 unknown_field) — send `token_address` only.',
  '- `profiler/address/pnl` requires a `date` range live although the schema marks it optional.',
  '- `v1beta1/profiler/historical-transaction-lookup` times out resolving a hash unless `block_timestamp` is sent.',
  '- `transaction-with-token-transfer-lookup` returns `nft_transfer_array: null` where the schema promises an array.',
  '- `GET /api/v1/account` (schema-less) returns `{user_id, plan, credits_remaining}`.',
  '- Earlier quirks (v1 hand-written contract) are preserved in `docs/nansen-quirks-v1.md`.',
  '', '## Per-operation detail', '');
for (const e of endpoints) {
  const reqS = deref(e.op.requestBody?.content?.['application/json']?.schema);
  const okC = e.op.responses?.['200']?.content;
  const resS = deref(okC ? (okC['application/json']?.schema ?? Object.values(okC)[0]?.schema) : undefined);
  const rowS = deref(resS?.properties?.data && (deref(resS.properties.data)?.items ?? resS.properties.data));
  const fields = (s: Schema | undefined) => (s?.properties ? Object.keys(s.properties).map((k) => (s.required?.includes(k) ? `**${k}**` : k)).join(', ') : '—');
  doc.push(`### \`${e.key}\``, '',
    `${(e.op.summary ?? '').trim()}. Tags: ${(e.op.tags ?? []).join(', ') || '—'}. Credits: ${e.credits ?? 'undocumented'}. Auth: ${e.security.join(', ') || '—'}. Source: \`${spec['x-source-page'][e.path] ?? '?'}\`.${e.op.deprecated ? ' **Deprecated.**' : ''}`,
    '',
    `- Request: ${reqS ? fields(reqS) : e.op.parameters?.length ? `query ${e.op.parameters.map((p) => (p.required ? `**${p.name}**` : p.name)).join(', ')}` : '—'}`,
    `- Response: ${fields(resS)}${rowS && rowS !== resS ? `; rows: ${fields(rowS)}` : ''}`,
    ...(e.chains ? [`- Chains (${e.chains.length}): ${e.chains.join(', ')}`] : []),
    '');
}
fs.writeFileSync('docs/nansen-contract.md', doc.join('\n'));
console.log(`api.gen.ts: ${order.length} schemas (${cyclic.size} cyclic) · ${endpoints.length} endpoints · credits known for ${endpoints.filter((e) => e.credits != null).length}`);
