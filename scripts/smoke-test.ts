// One-off manual smoke test for the Nansen client — not part of the test
// suite. Confirms auth, the real HTTP path, and header parsing all work
// before anything else is built on top of client.ts.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { callNansen } from '../src/server/nansen/client';

async function main() {
  const r = await callNansen<{ tokens: unknown[]; entities: unknown[]; total_results: number }>(
    'search/general',
    { search_query: 'AAVE', result_type: 'token', chain: 'ethereum', limit: 3 },
  );
  console.log('meta:', r.meta);
  console.log('total_results:', r.data.total_results);
  console.log('first token:', r.data.tokens[0]);
}

main().catch((e) => {
  console.error('SMOKE TEST FAILED:', e);
  process.exit(1);
});
