import { test, expect } from './fixtures';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import Database from 'better-sqlite3';
import { config } from 'dotenv';
import path from 'node:path';

// Bring-your-own-key, end to end, against a PUBLIC live instance
// (ACCOUNTS_URL, e.g. `tide-public` on :3301, sharing data/tide.db): a fresh
// wallet signs in, adds a Nansen key, becomes a member whose calls use and
// are billed to that key, then removes the key and signs out. Skipped when
// no URL or no key is available (demo runs, CI without secrets).
config({ path: '.env.local' });
const BASE = process.env.ACCOUNTS_URL;
const KEY = process.env.NANSEN_API_KEY;
const DB = process.env.ACCOUNTS_DB ?? 'data/tide.db';

test.skip(!BASE || !KEY, 'set ACCOUNTS_URL to a live public instance (needs NANSEN_API_KEY in .env.local)');
test.use({ baseURL: BASE });

test('sign in with a wallet, bring a key, become a member, leave cleanly', async ({ request, page }) => {
  const acct = privateKeyToAccount(generatePrivateKey());
  const headers = { 'content-type': 'application/json', origin: BASE! };

  // Signed-out: public.
  expect((await request.get('/api/keys')).status()).toBe(401);

  // Sign in.
  const { message } = await (await request.post('/api/auth/challenge', { headers, data: { family: 'evm', address: acct.address } })).json();
  const signature = await acct.signMessage({ message });
  const verify = await request.post('/api/auth/verify', { headers, data: { family: 'evm', message, signature } });
  expect(verify.status()).toBe(200);
  // A replayed signature is refused (nonce is single-use).
  expect((await request.post('/api/auth/verify', { headers, data: { family: 'evm', message, signature } })).status()).toBe(401);

  // Signed in without a key: still public.
  let k = await (await request.get('/api/keys')).json();
  expect(k.key).toBeNull();
  expect(k.mode).toBe('public');

  // Bring a key: verified with Nansen, stored sealed, never echoed back.
  const saved = await request.post('/api/keys', { headers, data: { apiKey: KEY } });
  expect(saved.status()).toBe(200);
  const savedBody = await saved.text();
  expect(savedBody.includes(KEY!)).toBe(false);
  k = await (await request.get('/api/keys')).json();
  expect(k.mode).toBe('member');
  expect(k.key.last4).toBe(KEY!.slice(-4));

  // The browser session sees the member view; the key never reaches the page.
  const cookies = (await request.storageState()).cookies;
  await page.context().addCookies(cookies);
  await page.goto('/');
  await expect(page.getByText(`Your key …${KEY!.slice(-4)}`)).toBeVisible();
  expect((await page.content()).includes(KEY!)).toBe(false);
  // Scanner smart-money history (operator's key) stays withheld for members.
  await expect(page.getByRole('heading', { name: /key-owner view only/ })).toBeVisible();

  // A live call made as the member is billed to them in the ledger.
  const before = Date.now();
  await page.goto('/chain/base');
  const db = new Database(path.resolve(DB), { readonly: true });
  const mine = db.prepare('SELECT COUNT(*) AS n FROM credit_ledger WHERE user_id IS NOT NULL AND called_at >= ?').get(before) as { n: number };
  db.close();
  expect(mine.n).toBeGreaterThan(0);

  // Leave: remove the key, sign out.
  expect((await request.delete('/api/keys', { headers })).status()).toBe(200);
  expect((await (await request.get('/api/keys')).json()).key).toBeNull();
  expect((await request.post('/api/auth/logout', { headers })).status()).toBe(200);
  expect((await request.get('/api/keys')).status()).toBe(401);
});
