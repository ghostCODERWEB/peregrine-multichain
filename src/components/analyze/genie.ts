/** The macOS genie effect, for a panel that opens from (and closes into) a
 *  button below it. The panel is drawn as thin horizontal strips; each frame,
 *  every strip is squeezed to the width of a funnel that bends from the
 *  panel's sides down to the button's, so the panel pours into the button.
 *  Two overlapping phases, as on the Mac: the sides bend first, then the
 *  contents slide down the funnel into the button. Opening plays it backwards. */

const STRIP = 10; // px per strip: fine enough that the funnel's edges read as curves
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => (1 - Math.cos(Math.PI * clamp01(x))) / 2;

/** Whether the genie fits: the button has to sit below the panel. */
export const canGenie = (panel: HTMLElement, to: DOMRect | null): to is DOMRect =>
  !!to && to.width > 0 && to.top >= panel.getBoundingClientRect().bottom - 4 &&
  !matchMedia('(prefers-reduced-motion: reduce)').matches;

export function genie(panel: HTMLElement, to: DOMRect, dir: 'in' | 'out', ms = dir === 'in' ? 540 : 480): Promise<void> {
  panel.style.animation = 'none'; // the CSS fallback would shift the panel while we measure it
  const r = panel.getBoundingClientRect();
  const n = Math.max(12, Math.min(64, Math.round(r.height / STRIP)));
  const h = r.height / n;
  const cs = getComputedStyle(panel);

  // Everything below the middle of the button is cut off, so the panel vanishes into it.
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  const clipY = to.top + to.height * 0.55;
  Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: '70', pointerEvents: 'none', clipPath: `inset(0 0 ${Math.max(0, innerHeight - clipY)}px 0)` });

  // A flat copy of the panel: no blur or shadow, which would be paid once per strip.
  const base = panel.cloneNode(true) as HTMLElement;
  base.removeAttribute('role'); base.removeAttribute('data-analyze-dock'); base.removeAttribute('aria-label');
  base.classList.remove('analyze-genie', 'is-closing');
  base.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
  Object.assign(base.style, {
    position: 'absolute', inset: 'auto', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    margin: '0', maxHeight: 'none', background: cs.backgroundColor, borderRadius: cs.borderRadius, border: cs.border,
    boxShadow: 'none', backdropFilter: 'none', animation: 'none', transition: 'none', opacity: '1', visibility: 'visible',
    transformOrigin: '0 0', willChange: 'transform', contain: 'layout paint',
  });
  const strips = Array.from({ length: n }, (_, i) => {
    const c = i ? (base.cloneNode(true) as HTMLElement) : base;
    layer.appendChild(c);
    return c;
  });
  document.body.appendChild(layer);

  // Clones lose scroll positions and typed text; copy them over.
  const src = [...panel.querySelectorAll<HTMLElement>('*')];
  const scrolled = src.flatMap((e, i) => (e.scrollTop ? [[i, e.scrollTop] as const] : []));
  const typed = src.flatMap((e, i) => (e instanceof HTMLTextAreaElement || e instanceof HTMLInputElement ? [[i, e.value] as const] : []));
  if (scrolled.length || typed.length) for (const s of strips) {
    const all = s.querySelectorAll<HTMLElement>('*');
    for (const [i, t] of scrolled) if (all[i]) all[i].scrollTop = t;
    for (const [i, v] of typed) if (all[i]) (all[i] as HTMLTextAreaElement).value = v;
  }

  const span = Math.max(1, to.top - r.top);
  const fall = to.bottom - r.top;
  const W = r.width;
  // p = 0: the open panel; p = 1: fully inside the button.
  const draw = (p: number) => {
    const bend = smooth(p / 0.55);
    const slide = smooth((p - 0.3) / 0.7);
    const dy = slide * fall;
    // The funnel's left and right edge at a screen height.
    const edge = (y: number) => { const k = smooth((y - r.top) / span) * bend; return [r.left + (to.left - r.left) * k, r.right + (to.right - r.right) * k]; };
    let [tl, tr] = edge(r.top + dy);
    for (let i = 0; i < n; i++) {
      const [bl, br] = edge(r.top + (i + 1) * h + dy);
      // Each strip is squeezed to its wider end and cut to a trapezoid whose top and bottom sit exactly on the
      // funnel, so neighbouring strips meet edge to edge and the sides read as one smooth curve.
      const x0 = Math.min(tl, bl), k = Math.max(0.001, (Math.max(tr, br) - x0) / W);
      const lx = (x: number) => ((x - x0) / k).toFixed(1);
      const y0 = Math.max(0, i * h - 0.3), y1 = Math.min(r.height, (i + 1) * h + 0.3);
      strips[i].style.transform = `translate(${x0 - r.left}px, ${dy}px) scaleX(${k})`;
      strips[i].style.clipPath = `polygon(${lx(tl)}px ${y0}px, ${lx(tr)}px ${y0}px, ${lx(br)}px ${y1}px, ${lx(bl)}px ${y1}px)`;
      tl = bl; tr = br;
    }
  };

  panel.style.visibility = 'hidden';
  draw(dir === 'in' ? 1 : 0);
  return new Promise((resolve) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (dir === 'in') panel.style.visibility = '';
      layer.remove();
      resolve();
    };
    const t0 = performance.now();
    const tick = (now: number) => {
      if (finished) return;
      const t = clamp01((now - t0) / ms);
      draw(dir === 'in' ? 1 - t : t);
      if (t < 1) requestAnimationFrame(tick); else finish();
    };
    requestAnimationFrame(tick);
    // A background tab pauses animation frames; never leave the panel hidden.
    setTimeout(finish, ms + 400);
  });
}
