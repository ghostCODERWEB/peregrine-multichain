import { NextResponse } from 'next/server';
import { ADDRESS_RE, COIN_RE, coinLogo, stockLogo, tokenLogo } from '@/server/logos/resolve';

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
  if (!url) {
    // No logo anywhere: a neutral monogram, so the page never shows a broken image.
    const letters = (q.get('s') ?? coin ?? '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '?';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#2a2f36"/><text x="32" y="32" dy=".35em" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="${letters.length > 2 ? 20 : 24}" fill="#c9d1d9">${letters}</text></svg>`;
    return new NextResponse(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } });
  }
  return NextResponse.redirect(url, { status: 302, headers: { 'cache-control': 'public, max-age=604800' } });
}
