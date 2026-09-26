'use client';
// Chain and token logos (P2). Chain logos and a short allowlist of
// unambiguous major tokens are bundled under /public/logos (MIT, see
// NOTICE.md), so they never leave the app's own origin. Any other token uses
// the `logo` URL Nansen returned for it, loaded by the viewer's browser only
// (never fetched by the server) with no referrer; when there is none, or it
// fails, a letter badge stands in. A shared symbol never borrows another
// project's logo: symbol icons are an allowlist, not a lookup.
import { useEffect, useRef, useState } from 'react';
import manifest from '../../public/logos/manifest.json';
import { chainName } from '@/lib/viz/format';

const CHAINS = new Set<string>(manifest.chains);
const TOKENS = new Set<string>(manifest.tokens);
// Monochrome dark marks that vanish on the dark theme ship a white variant
// (`<name>.light.svg`); CSS shows one or the other by theme (.logo-on-*).
const LIGHT_CHAINS = new Set<string>(manifest.lightVariants.chains);
const LIGHT_TOKENS = new Set<string>(manifest.lightVariants.tokens);

/** An <img> for a bundled logo, paired with its white variant when it has one. */
function Themed({ src, light, alt = '', ...img }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string; light: string | null }) {
  /* eslint-disable @next/next/no-img-element -- local, fixed-size SVGs; next/image adds nothing here */
  if (!light) return <img src={src} alt={alt} {...img} />;
  return (
    <>
      <img src={src} alt={alt} {...img} className={`${img.className ?? ''} logo-on-light`} />
      <img src={light} alt={alt} {...img} className={`${img.className ?? ''} logo-on-dark`} />
    </>
  );
  /* eslint-enable @next/next/no-img-element */
}

function Badge({ text, size, round }: { text: string; size: number; round: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center bg-raised font-semibold text-ink-2 ring-1 ring-border ${round ? 'rounded-full' : 'rounded'}`}
      style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.42)) }}
    >
      {text
        .replace(/[^A-Za-z0-9]/g, '')
        .slice(0, size >= 28 ? 3 : 2)
        .toUpperCase() || '?'}
    </span>
  );
}

/** The bundled logo path for a chain, or null. */
export const chainLogoSrc = (chain: string) => (CHAINS.has(chain) ? `/logos/chains/${chain}.svg` : null);

/** A chain logo inside an SVG chart, theme-aware like ChainLogo; null when the chain has none. */
export function SvgChainLogo({ chain, x, y, size, opacity }: { chain: string; x: number; y: number; size: number; opacity?: number }) {
  const src = chainLogoSrc(chain);
  if (!src) return null;
  const p = { x, y, width: size, height: size, opacity };
  if (!LIGHT_CHAINS.has(chain)) return <image href={src} {...p} />;
  return (
    <>
      <image href={src} {...p} className="logo-on-light" />
      <image href={`/logos/chains/${chain}.light.svg`} {...p} className="logo-on-dark" />
    </>
  );
}

/** A chain's logo. Decorative when the chain's name is printed beside it. */
export function ChainLogo({ chain, size = 16, labelled = false }: { chain: string; size?: number; labelled?: boolean }) {
  if (!CHAINS.has(chain)) return <Badge text={chainName(chain)} size={size} round={false} />;
  return (
    <Themed
      src={`/logos/chains/${chain}.svg`}
      light={LIGHT_CHAINS.has(chain) ? `/logos/chains/${chain}.light.svg` : null}
      width={size}
      height={size}
      alt={labelled ? chainName(chain) : ''}
      className="shrink-0 rounded"
      loading="lazy"
      decoding="async"
    />
  );
}

/** A token's logo: Nansen's logo URL, else a bundled major-token icon, else a free public source
 *  (/api/logo: DexScreener, Jupiter, Hyperliquid coin icons), else a letter badge. */
export function TokenLogo({
  symbol,
  logo,
  chain,
  address,
  coin,
  size = 20,
  badge = true,
}: {
  symbol: string | null | undefined;
  logo?: string | null;
  /** With address: look the token up in free public sources when Nansen has no logo. */ chain?: string | null;
  address?: string | null;
  /** A Hyperliquid perp coin: its public coin icon. */ coin?: string | null;
  size?: number;
  /** false: render nothing when there is no real logo (dense chips) */ badge?: boolean;
}) {
  const sym = (symbol ?? '').replace(/^\$/, '').toUpperCase();
  const local = TOKENS.has(sym) ? `/logos/tokens/${sym}.svg` : null;
  const localLight = LIGHT_TOKENS.has(sym) ? `/logos/tokens/${sym}.light.svg` : null;
  const remote = logo && /^https:\/\//.test(logo) ? logo : null;
  const [failed, setFailed] = useState<string[]>([]);
  const ref = useRef<HTMLImageElement>(null);
  const lookup = coin ? `/api/logo?coin=${encodeURIComponent(coin)}&s=${encodeURIComponent(sym)}` : chain && address ? `/api/logo?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}&s=${encodeURIComponent(sym)}` : null;
  const src = [remote, local, lookup].find((u) => u && !failed.includes(u));
  // An image that failed before hydration never fires onError: check once mounted.
  useEffect(() => { const el = ref.current; if (el && src && el.complete && el.naturalWidth === 0) setFailed((f) => (f.includes(src) ? f : [...f, src])); }, [src]);
  if (!src) return badge ? <Badge text={sym || '?'} size={size} round /> : null;
  if (src === local && localLight)
    return <Themed src={local} light={localLight} width={size} height={size} alt="" className="shrink-0 rounded-full object-cover" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote logos are Nansen-supplied URLs on arbitrary hosts; no image optimizer proxies them
    <img
      ref={ref}
      src={src}
      width={size}
      height={size}
      alt=""
      referrerPolicy={src === lookup ? undefined : 'no-referrer'}
      loading="lazy"
      decoding="async"
      className="shrink-0 rounded-full bg-raised object-cover"
      onError={() => setFailed((f) => [...f, src])}
    />
  );
}

/** A chain logo on a uniform round badge, so marks of any shape (squares, glyphs) sit at one size. */
export function ChainBadge({ chain, size = 28, className = '' }: { chain: string; size?: number; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full bg-[var(--surface-2)] ring-2 ring-[var(--surface-1)] ${className}`} style={{ width: size, height: size }}>
      <ChainLogo chain={chain} size={Math.round(size * 0.58)} />
    </span>
  );
}

/** A from → to chain pair as two overlapping badges. */
export function ChainPair({ from, to, size = 28 }: { from: string; to: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center" aria-hidden>
      <ChainBadge chain={from} size={size} />
      <ChainBadge chain={to} size={size} className="-ml-2" />
    </span>
  );
}
