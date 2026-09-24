'use client';
// Chain and token logos (P2). Chain logos and a short allowlist of
// unambiguous major tokens are bundled under /public/logos (MIT, see
// NOTICE.md), so they never leave the app's own origin. Any other token uses
// the `logo` URL Nansen returned for it, loaded by the viewer's browser only
// (never fetched by the server) with no referrer; when there is none, or it
// fails, a letter badge stands in. A shared symbol never borrows another
// project's logo: symbol icons are an allowlist, not a lookup.
import { useState } from 'react';
import manifest from '../../public/logos/manifest.json';
import { chainName } from '@/lib/viz/format';

const CHAINS = new Set<string>(manifest.chains);
const TOKENS = new Set<string>(manifest.tokens);

function Badge({ text, size, round }: { text: string; size: number; round: boolean }) {
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center bg-raised font-semibold text-ink-2 ring-1 ring-border ${round ? 'rounded-full' : 'rounded'}`}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.42)) }}>
      {text.replace(/[^A-Za-z0-9]/g, '').slice(0, size >= 28 ? 3 : 2).toUpperCase() || '?'}
    </span>
  );
}

/** The bundled logo path for a chain, or null (SVG charts draw it with <image>). */
export const chainLogoSrc = (chain: string) => (CHAINS.has(chain) ? `/logos/chains/${chain}.svg` : null);

/** A chain's logo. Decorative when the chain's name is printed beside it. */
export function ChainLogo({ chain, size = 16, labelled = false }: { chain: string; size?: number; labelled?: boolean }) {
  if (!CHAINS.has(chain)) return <Badge text={chainName(chain)} size={size} round={false} />;
  // eslint-disable-next-line @next/next/no-img-element -- a local, fixed-size SVG; next/image adds nothing here
  return <img src={`/logos/chains/${chain}.svg`} width={size} height={size} alt={labelled ? chainName(chain) : ''} className="shrink-0 rounded" loading="lazy" decoding="async" />;
}

/** A token's logo: Nansen's logo URL, else a bundled major-token icon, else a letter badge. */
export function TokenLogo({ symbol, logo, size = 20 }: { symbol: string | null | undefined; logo?: string | null; size?: number }) {
  const sym = (symbol ?? '').replace(/^\$/, '').toUpperCase();
  const local = TOKENS.has(sym) ? `/logos/tokens/${sym}.svg` : null;
  const remote = logo && /^https:\/\//.test(logo) ? logo : null;
  const [failed, setFailed] = useState<string[]>([]);
  const src = [remote, local].find((u) => u && !failed.includes(u));
  if (!src) return <Badge text={sym || '?'} size={size} round />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote logos are Nansen-supplied URLs on arbitrary hosts; no image optimizer proxies them
    <img src={src} width={size} height={size} alt="" referrerPolicy="no-referrer" loading="lazy" decoding="async"
      className="shrink-0 rounded-full bg-raised object-cover" onError={() => setFailed((f) => [...f, src])} />
  );
}
