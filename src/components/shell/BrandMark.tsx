/** The TIDE mark: three swell lines rising left to right, mint into violet. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="tide-mark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--brand-2)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#tide-mark)" opacity="0.14" />
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="none" stroke="url(#tide-mark)" strokeOpacity="0.55" />
      {[21, 16, 11].map((y, i) => (
        <path key={y} d={`M6 ${y + 2} C 10 ${y - 3}, 14 ${y + 5}, 18 ${y} S 24 ${y - 4}, 26 ${y - 1}`}
          fill="none" stroke="url(#tide-mark)" strokeWidth={2.2 - i * 0.3} strokeLinecap="round" opacity={1 - i * 0.22} />
      ))}
    </svg>
  );
}
