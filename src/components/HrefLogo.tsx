import { TokenLogo } from '@/components/Logo';

/** A token or perp logo read off a link: /token/<chain>/<address> or /perps/<coin>. Nothing for other links. */
export function HrefLogo({ href, size = 16 }: { href: string; size?: number }) {
  const path = href.split(/[?#]/)[0];
  const t = /^\/token\/([^/]+)\/([^/]+)$/.exec(path);
  if (t) return <TokenLogo symbol={null} chain={t[1]} address={decodeURIComponent(t[2])} size={size} />;
  const p = /^\/perps\/([^/]+)$/.exec(path);
  if (p) { const coin = decodeURIComponent(p[1]); return <TokenLogo symbol={coin} coin={coin} size={size} />; }
  return null;
}

export const hasHrefLogo = (href: string) => /^\/(token\/[^/]+\/[^/?#]+|perps\/[^/?#]+)([?#]|$)/.test(href);
