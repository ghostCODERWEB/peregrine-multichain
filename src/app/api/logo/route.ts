import { NextResponse } from 'next/server';
import { ADDRESS_RE, COIN_RE, coinLogo, stockLogo, tokenLogo, symbolLogo, cleanSymbol } from '@/server/logos/resolve';

/** Redirects to a token's (or perp coin's) logo image; 404 when none is known. Browsers cache either answer. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const coin = q.get('coin'), chain = q.get('chain') ?? '', address = q.get('address') ?? '';
  let url: string | null = null;
  if (coin && COIN_RE.test(coin)) url = await coinLogo(coin);
  else if (/^[a-z0-9-]{2,20}$/.test(chain) && ADDRESS_RE.test(address)) {
    url = await tokenLogo(chain, address);
    if (!url && chain === 'robinhood' && q.get('s')) url = await stockLogo(q.get('s')!);
  }
  if (!url && q.get('s')) {
    // Wrapped or bridged versions of a major asset (WBTC, SCBTC, cbETH, USDC.e) wear the parent's logo.
    const base = baseAsset(q.get('s')!);
    if (base) url = await coinLogo(base);
  }
  // Still nothing: look the symbol up in public icon sets, then as a tokenized stock ticker.
  if (!url && q.get('s')) url = await symbolLogo(q.get('s')!);
  if (!url && q.get('s') && (chain === 'robinhood' || /^[A-Z]{2,5}X$/.test(cleanSymbol(q.get('s')!)))) url = await stockLogo(cleanSymbol(q.get('s')!).replace(/X$/, ''));
  if (!url) {
    // No logo anywhere: a neutral monogram, so the page never shows a broken image.
    const letters = (q.get('s') ?? coin ?? '?').replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '?';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#2a2f36"/><text x="32" y="32" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="${letters.length > 2 ? 20 : 24}" fill="#c9d1d9">${letters}</text></svg>`;
    return new NextResponse(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' } });
  }
  return NextResponse.redirect(sized(url), { status: 302, headers: { 'cache-control': 'public, max-age=604800' } });
}

/** Dexscreener serves token images at whatever size is asked, and its links ask for 800px (often 100-400 KB).
 *  Logos show at 64px at most, so 128px keeps them sharp on 2x screens at a few KB. */
function sized(url: string): string {
  if (!url.startsWith('https://cdn.dexscreener.com/')) return url;
  const u = new URL(url);
  u.searchParams.set('width', '128');
  u.searchParams.set('height', '128');
  u.searchParams.set('quality', '90');
  return u.toString();
}

const BASES: Array<[RegExp, string]> = [
  [/BTC/, 'BTC'],
  [/^(W|CB|ST|WST|R|WE|M|SW|OS|EZ|RS|W?BE|AAVE|A|AARB)?ETH(ER)?$|^WEETH$|^ETH[.-]/, 'ETH'],
  [/^(A|AARB|W|B|S)?USDC(\.E)?$|^USDC[.-]/, 'USDC'],
  [/^(A|W|B|S)?USDT0?(\.E)?$|^USD₮0?$/, 'USDT'],
  [/^(W|J|M|B|JITO|INF)SOL$/, 'SOL'],
  [/^W?BNB$/, 'BNB'],
  [/^W?AVAX$/, 'AVAX'],
  [/^W?HYPE$/, 'HYPE'],
  [/^W?POL$|^W?MATIC$/, 'POL'],
  [/^W?S$/, 'S'],
  [/^W?MNT$/, 'MNT'],
  [/^W?MON$/, 'MON'],
  [/^DAI$|^SDAI$/, 'DAI'],
];

function baseAsset(symbol: string): string | null {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9.₮-]/g, '');
  for (const [re, base] of BASES) if (re.test(s)) return base;
  return null;
}
