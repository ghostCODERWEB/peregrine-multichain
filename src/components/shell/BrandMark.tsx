/** Peregrine's mark: a falcon in a stoop, wings swept back into a dive, drawn as one geometric shape. */
export function BrandMark({ size = 22 }: { size?: number }) {
  // One gradient id: every copy of the mark defines the same gradient, so sharing it is safe.
  const id = 'mark';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={`pg-${id}`} x1="4" y1="6" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7ff7d4" />
          <stop offset=".55" stopColor="#1fe0a3" />
          <stop offset="1" stopColor="#0aa58f" />
        </linearGradient>
      </defs>
      {/* Wings: swept from the tips down into the body. */}
      <path d="M2.5 7.5 C9 7.8 13.2 10.2 16 14.6 C18.8 10.2 23 7.8 29.5 7.5 C25.4 10.4 22.2 13.8 20.1 18.3 L16 28 L11.9 18.3 C9.8 13.8 6.6 10.4 2.5 7.5 Z" fill={`url(#pg-${id})`} />
      {/* The head's notch and the keel line that give the dive its direction. */}
      <path d="M16 14.6 L14.2 11.2 L16 12.4 L17.8 11.2 Z" fill={`url(#pg-${id})`} />
      <path d="M16 16.2 L16 25.2" stroke="rgba(3,20,14,.55)" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
