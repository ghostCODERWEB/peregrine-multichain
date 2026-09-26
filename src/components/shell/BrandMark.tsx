/** Peregrine's logo: the falcon mark, in a glass-rimmed badge whose corners are concentric with the sidebar panel (29% of its size).
 *  The source image carries its own rounded-square frame; zooming in to 1.34 keeps only the falcon on its dark field. */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <span className="brand-mark relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full lg:rounded-[29%]" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a small static brand image */}
      <img src="/brand/peregrine-256.png" alt="" width={size} height={size} className="h-full w-full scale-[1.34] object-cover" />
    </span>
  );
}
