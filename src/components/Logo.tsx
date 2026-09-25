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

/** A token's logo: Nansen's logo URL, else a bundled major-token icon, else a letter badge. */
export function TokenLogo({
  symbol,
  logo,
  size = 20,
  badge = true,
}: {
  symbol: string | null | undefined;
  logo?: string | null;
  size?: number;
  /** false: render nothing when there is no real logo (dense chips) */ badge?: boolean;
}) {
  const sym = (symbol ?? '').replace(/^\$/, '').toUpperCase();
  const local = TOKENS.has(sym) ? `/logos/tokens/${sym}.svg` : null;
  const localLight = LIGHT_TOKENS.has(sym) ? `/logos/tokens/${sym}.light.svg` : null;
  const remote = logo && /^https:\/\//.test(logo) ? logo : null;
  const [failed, setFailed] = useState<string[]>([]);
  const src = [remote, local].find((u) => u && !failed.includes(u));
  if (!src) return badge ? <Badge text={sym || '?'} size={size} round /> : null;
  if (src === local && localLight)
    return <Themed src={local} light={localLight} width={size} height={size} alt="" className="shrink-0 rounded-full object-cover" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote logos are Nansen-supplied URLs on arbitrary hosts; no image optimizer proxies them
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      className="shrink-0 rounded-full bg-raised object-cover"
      onError={() => setFailed((f) => [...f, src])}
    />
  );
}
