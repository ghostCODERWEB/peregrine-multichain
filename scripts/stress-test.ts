// One-off: fires 200 concurrent calls at the free (0-credit) search
// endpoint to prove the limiter holds the real API under its rate caps
// with zero unhandled 429s, before anything more expensive is built on it.
import { config } from 'dotenv';
config({ path: '.env.local' });
import { callNansen } from '../src/server/nansen/client';

async function main() {
  const started = Date.now();
  const queries = Array.from({ length: 200 }, (_, i) => `token${i % 20}`);
  const results = await Promise.allSettled(
    queries.map((q) => callNansen<{ total_results: number }>(
      'search/general',
      { search_query: q, result_type: 'token', limit: 1 },
      { skipCache: true }, // force real calls, not the cache from repeated queries
    )),
  );
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
  const rateLimited = failed.filter((r) => String(r.reason).includes('429'));

  console.log(`${ok}/200 ok, ${failed.length} failed (${rateLimited.length} were 429s), took ${Date.now() - started}ms`);
  if (failed.length) {
    console.log('first failure:', failed[0].reason);
  }
  if (rateLimited.length > 0) {
    console.error('FAIL: unhandled 429s got through the limiter');
    process.exit(1);
  }
  console.log('PASS: no unhandled 429s');
}

main().catch((e) => { console.error(e); process.exit(1); });
