// The token terminal's on-demand calls: only on a click, each cached.
//   txLookup     — transaction drill-down (1 credit)
//   newsSearch   — Nansen-hosted web search for the token (5 credits)
//   newsSummary  — Nansen fetches one article and answers a question about
//                  it (20 credits; owner and members only, hourly cap)
import { callNansen } from '@/server/nansen/client';
import { callsSince } from '@/server/nansen/ledger';
import { errText, type Wave } from '@/server/nansen/traced';
import { contractUnavailable } from '@/server/nansen/support';
import { S_WebSearchResponse, S_WebFetchResponse, S_RaPostsResponse } from '@/types/nansen/extra';
import { authorWeek, type AuthorWeek } from '@/lib/models/author-week';
import { requestDay } from '@/server/nansen/demo';
import type { TransactionLookupResponse } from '@/types/nansen/api.gen';

// ------------------------------------------------------------ transaction

export interface TxTransfer { from: string; fromLabel: string | null; to: string; toLabel: string | null; symbol: string; amount: number; valueUsd: number | null; token: string }
export interface TxDetail {
  chain: string; hash: string; at: string; ok: boolean;
  from: string; fromLabel: string | null; to: string; toLabel: string | null;
  nativeValue: number; nativeUsd: number | null;
  transfers: TxTransfer[];
}

export async function txLookup(chain: string, hash: string, blockTimestamp: string | null): Promise<Wave<TxDetail>> {
  const gap = contractUnavailable('POST /api/v1/transaction-with-token-transfer-lookup', chain, 'Transaction lookup');
  if (gap) return { unavailable: gap };
  try {
    const r = await callNansen<{ data?: TransactionLookupResponse | TransactionLookupResponse[] } & Partial<TransactionLookupResponse>>(
      'transaction-with-token-transfer-lookup', { chain, transaction_hash: hash, ...(blockTimestamp ? { block_timestamp: blockTimestamp } : {}) },
    );
    // Nansen answers { data: [tx] } live; the schema describes the tx itself.
    const raw = r.data.data ?? (r.data.transaction_hash ? (r.data as TransactionLookupResponse) : null);
    const tx = Array.isArray(raw) ? raw[0] : raw;
    if (!tx) return { unavailable: 'Nansen did not find this transaction.' };
    return {
      chain: tx.chain, hash: tx.transaction_hash, at: tx.block_timestamp, ok: tx.receipt_status === 1,
      from: tx.from_address, fromLabel: tx.from_address_label || null, to: tx.to_address, toLabel: tx.to_address_label || null,
      nativeValue: tx.native_value, nativeUsd: Number.isFinite(tx.dated_native_value_usd) ? tx.dated_native_value_usd : null,
      transfers: (tx.token_transfer_array ?? []).map((t) => ({
        from: t.from_address, fromLabel: t.from_address_label || null, to: t.to_address, toLabel: t.to_address_label || null,
        symbol: t.token_symbol, amount: t.token_amount, valueUsd: Number.isFinite(t.dated_value_usd) ? t.dated_value_usd : null, token: t.token_address,
      })),
    };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

// ------------------------------------------------------------------- news

export interface NewsItem { title: string; url: string; host: string; snippet: string | null; date: string | null }

/** Web results about the token from Nansen's hosted search (5 credits,
 *  cached for six hours per query). */
export async function newsSearch(name: string | null, symbol: string | null): Promise<Wave<{ query: string; items: NewsItem[] }>> {
  const words = [name, symbol && name?.toLowerCase() !== symbol.toLowerCase() ? symbol : null].filter(Boolean).join(' ');
  if (!words) return { unavailable: 'No token name or symbol to search for.' };
  const query = `${words} crypto news`;
  try {
    const r = await callNansen<unknown>('search/web-search', { queries: [query], num_results: 8 });
    const parsed = S_WebSearchResponse.safeParse(r.data);
    if (!parsed.success) return { unavailable: 'Nansen’s web search answered in an unexpected shape.' };
    const items: NewsItem[] = parsed.data.results.flatMap((x) => x.organic ?? []).flatMap((o) => {
      try {
        const u = new URL(o.link);
        if (u.protocol !== 'https:' && u.protocol !== 'http:') return [];
        return [{ title: o.title ?? u.hostname, url: u.toString(), host: u.hostname.replace(/^www\./, ''), snippet: o.snippet ?? null, date: o.date ?? null }];
      } catch {
        return [];
      }
    }).slice(0, 8);
    if (!items.length) return { unavailable: `Nansen’s web search found nothing for “${query}”.` };
    return { query, items };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

export const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

/** On demand: one author's week (ra-agent/posts-by-user, 5 credits, cached an
 *  hour): reach, and how many other tokens the same account pushed. */
export async function authorPosts(username: string, symbol: string | null): Promise<Wave<AuthorWeek>> {
  if (!HANDLE.test(username)) return { unavailable: 'Not a valid X handle.' };
  const body = { date: { from: requestDay(7), to: requestDay(0) }, username, pagination: { page: 1, per_page: 100 } };
  try {
    const r = await callNansen<unknown>('ra-agent/posts-by-user', body);
    const parsed = S_RaPostsResponse.safeParse(r.data);
    if (!parsed.success) return { unavailable: 'Nansen’s social posts answered in an unexpected shape.' };
    const posts = parsed.data.data.filter((p) => p.username?.toLowerCase() === username.toLowerCase())
      .map((p) => ({ at: p.timestamp, text: p.text ?? '', views: p.views ?? null, likes: p.likes ?? null, id: p.tweet_id ?? null }));
    if (!posts.length) return { unavailable: `Nansen has no posts by @${username} in the last 7 days.` };
    return authorWeek(username, symbol, posts);
  } catch (e) {
    return { unavailable: errText(e) };
  }
}

export const SUMMARY_MAX_PER_HOUR = () => Number(process.env.WEB_FETCH_MAX_PER_HOUR ?? 10);

/** Nansen fetches one article and says what it reports about the token
 *  (20 credits, cached a day per URL). */
export async function newsSummary(url: string, symbol: string | null): Promise<Wave<{ url: string; analysis: string; retrieved: boolean }>> {
  let u: URL;
  try { u = new URL(url); } catch { return { unavailable: 'Not a valid URL.' }; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { unavailable: 'Only web pages can be summarized.' };
  if (callsSince('search/web-fetch', Date.now() - 3_600_000) >= SUMMARY_MAX_PER_HOUR()) {
    return { unavailable: `The hourly limit of ${SUMMARY_MAX_PER_HOUR()} article summaries (20 credits each) is reached; try again later.` };
  }
  const question = `What does this page report about ${symbol ?? 'this token'}? Three sentences, facts and dates only, no opinion or advice.`;
  try {
    const r = await callNansen<unknown>('search/web-fetch', { urls: [u.toString()], question });
    const parsed = S_WebFetchResponse.safeParse(r.data);
    if (!parsed.success) return { unavailable: 'Nansen’s page fetch answered in an unexpected shape.' };
    return { url: u.toString(), analysis: parsed.data.analysis, retrieved: (parsed.data.retrieved_urls ?? []).length > 0 };
  } catch (e) {
    return { unavailable: errText(e) };
  }
}
