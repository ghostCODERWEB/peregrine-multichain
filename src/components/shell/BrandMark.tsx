/** Peregrine's logo: the falcon mark. */
export function BrandMark({ size = 22 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element -- a small static brand image
  return <img src="/brand/peregrine-256.png" alt="" width={size} height={size} className="shrink-0 rounded-[22%]" style={{ width: size, height: size }} />;
}
