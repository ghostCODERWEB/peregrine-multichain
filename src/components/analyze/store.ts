'use client';
// Page data that components register for Analyze with Nansen (the numbers
// behind a view, not its pixels), and a way to open the dock with an element.

const pages = new Map<string, unknown>();

/** Registers a view's underlying data while it is mounted; returns the unregister function. */
export function registerPageContext(view: string, context: unknown): () => void {
  pages.set(view, context);
  return () => { if (pages.get(view) === context) pages.delete(view); };
}

export function pageContexts(): Record<string, unknown> {
  return Object.fromEntries(pages);
}

/** Opens the dock, optionally with an element already selected. */
export function openAnalyze(el?: Element | null) {
  window.dispatchEvent(new CustomEvent('peregrine:analyze', { detail: el ?? null }));
}
