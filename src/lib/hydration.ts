// Scripts that adjust server-rendered markup (the table pager, the phone clamp) must not touch a streamed
// section until React has finished hydrating it: React hydrates in document order and can pause partway, and
// an extra element (a pager bar, a "Show all" button) or a changed row it meets there is a hydration error that
// throws the section away and re-renders it on the client.

const hasFiber = (el: Element) => Object.keys(el).some((k) => k.startsWith('__reactFiber'));

/** Elements these scripts add themselves: never React's, so never a sign of hydration. */
const OURS = '.pager, .clamp-toggle';

/** The first element after `el` in document order that is not inside it, skipping our own additions. */
function nextOutside(el: Element): Element | null {
  for (let at: Element | null = el; at; at = at.parentElement) {
    for (let s = at.nextElementSibling; s; s = s.nextElementSibling) if (!s.matches(OURS)) return s;
  }
  return null;
}

/** True once React has hydrated `el` and moved past it: the next element in document order is hydrated too
 *  (or, at the very end of the document, `el`'s parent is). Only then may `el` and its subtree be changed. */
export function hydratedPast(el: Element): boolean {
  if (!hasFiber(el)) return false;
  const next = nextOutside(el);
  return next ? hasFiber(next) : !!el.parentElement && hasFiber(el.parentElement);
}
