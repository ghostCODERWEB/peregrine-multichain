// Scripts that adjust server-rendered markup (the table pager, the phone clamp) must not touch a streamed
// section until React has finished hydrating it: an attribute React has not checked yet (a paged-out row) or an
// extra element it meets (a pager bar, a "Show all" button) is a hydration error that throws the section away
// and re-renders it on the client.
//
// React records its fiber on a DOM node once it has hydrated that node, and completes a parent only after all
// of its children. So a node carrying a fiber, whose parent carries one too, sits in a finished subtree. The
// element *after* a node is no signal on its own: it can belong to another streamed section that hydrated first.

const hasFiber = (el: Element | null | undefined) => !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber'));

/** True once React has hydrated `el` and its parent (so `el`'s whole subtree, and the spot right after it), and
 *  every element in `also` (e.g. the last row of a list about to be paged). Only then may they be changed. */
export function hydratedPast(el: Element, ...also: Array<Element | null | undefined>): boolean {
  return hasFiber(el) && hasFiber(el.parentElement) && also.every((x) => !x || hasFiber(x));
}
