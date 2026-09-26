/** Peregrine's logo: the falcon mark, in a round glass-rimmed badge like the app's round controls. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <span className="brand-mark relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static brand image */}
      <img src="/brand/peregrine-256.png" alt="" width={size} height={size} className="h-full w-full scale-[1.12] object-cover" />
    </span>
  );
}
