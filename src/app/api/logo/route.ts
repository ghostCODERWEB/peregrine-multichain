import { NextResponse } from 'next/server';
import { ADDRESS_RE, COIN_RE, perpIcon, tokenLogo } from '@/server/logos/resolve';

/** Redirects to a token's (or perp coin's) logo image; 404 when none is known. Browsers cache either answer. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const coin = q.get('coin'), chain = q.get('chain') ?? '', address = q.get('address') ?? '';
  let url: string | null = null;
  if (coin && COIN_RE.test(coin)) url = perpIcon(coin);
  else if (/^[a-z0-9-]{2,20}$/.test(chain) && ADDRESS_RE.test(address)) url = await tokenLogo(chain, address);
  if (!url) return new NextResponse(null, { status: 404, headers: { 'cache-control': 'public, max-age=86400' } });
  return NextResponse.redirect(url, { status: 302, headers: { 'cache-control': 'public, max-age=604800' } });
}
