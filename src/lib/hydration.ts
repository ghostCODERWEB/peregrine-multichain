// Scripts that adjust server-rendered markup (the table pager, the phone clamp) must not touch a streamed
// section until React has finished hydrating it: an attribute React has not checked yet (a paged-out row) or an
// extra element it meets (a pager bar, a "Show all" button) is a hydration error that throws the section away
// and re-renders it on the client.
//
// A fiber on a DOM node is not proof on its own: when a section suspends mid-hydration (a lazily loaded chart
// inside it), React abandons that pass but the nodes it already claimed keep their fiber, and the retry later
// meets whatever was changed in between. So the node's fiber path must also pass through no Suspense boundary
// that is still dehydrated (React keeps `memoizedState.dehydrated` on it until the section has hydrated).

type Fiber = { tag?: number; return?: Fiber | null; memoizedState?: { dehydrated?: unknown } | null };

const SUSPENSE = 13; // React's SuspenseComponent work tag

// React names the property `__reactFiber$<random>`, the same for every node of the app: found once, then read directly
// (listing every node's own keys was a measurable share of these checks on long pages).
let fiberKey: string | null = null;

function fiberOf(el: Element | null | undefined): Fiber | null {
  if (!el) return null;
  const node = el as unknown as Record<string, Fiber | undefined>;
  if (fiberKey) return node[fiberKey] ?? null;
  const key = Object.keys(el).find((k) => k.startsWith('__reactFiber'));
  if (!key) return null;
  fiberKey = key;
  return node[key] ?? null;
}

/** React has hydrated (or rendered) this node. */
export const isHydrated = (el: Element): boolean => fiberOf(el) != null;

/** Hydrated, and not inside a section React is still hydrating (or abandoned and will retry). */
function settled(el: Element | null | undefined): boolean {
  let f = fiberOf(el);
  if (!f) return false;
  for (let guard = 0; f && guard < 500; f = f.return ?? null, guard++) {
    if (f.tag === SUSPENSE && f.memoizedState?.dehydrated) return false;
  }
  return true;
}

/** True once React has hydrated `el`, its parent (so the spot right after `el`) and every element in `also`
 *  (e.g. the last row of a list about to be paged), outside any section still hydrating. Only then may they
 *  be changed. */
export function hydratedPast(el: Element, ...also: Array<Element | null | undefined>): boolean {
  return settled(el) && settled(el.parentElement) && also.every((x) => !x || settled(x));
}

/** Runs `fn` once the first page load has finished hydrating: after the load event and an idle moment.
 *  The per-node check above can pass while React is still mid-way through a section (it claims nodes before it
 *  commits), so scripts that change server-rendered markup wait for this first. Later calls run at once. */
let hydrationDone = false;
export function afterHydration(fn: () => void): () => void {
  if (hydrationDone) { fn(); return () => {}; }
  let cancelled = false, idle = 0;
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  const go = () => { if (cancelled) return; hydrationDone = true; fn(); };
  const onLoad = () => { idle = w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 1500 }) : window.setTimeout(go, 300); };
  if (document.readyState === 'complete') onLoad(); else window.addEventListener('load', onLoad, { once: true });
  return () => { cancelled = true; window.removeEventListener('load', onLoad); if (w.cancelIdleCallback) w.cancelIdleCallback(idle); else window.clearTimeout(idle); };
}
