/** The Peregrine mark: a falcon in a stoop (its dive), as a flat arrowhead
 *  with swept wings and a keel. One brand color, no gradient. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M3 6 L16 12.5 L29 6 L22.5 17.5 L16 29 L9.5 17.5 Z" fill="var(--brand)" />
      <path d="M16 12.5 L16 29" stroke="var(--surface-1)" strokeWidth="1.6" />
    </svg>
  );
}
