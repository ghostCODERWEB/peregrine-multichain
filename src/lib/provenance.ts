// What every ⓘ popover shows: the formula, the inputs that went into this
// specific number, and the exact Nansen call(s) the inputs came from. Plain
// data so the server can build it next to the number and the client just
// renders it — the claim "every number traces to a Nansen response" is
// only true if the trace is assembled where the number is computed.

export interface NansenCallRef {
  /** API path, e.g. "token-screener". */
  endpoint: string;
  /** The request body (or query) exactly as sent. */
  body?: unknown;
  /** Credits per call, when known. */
  credits?: number;
  /** Where the response lives: a cache key, or a scanner snapshot/run id. */
  ref?: string;
}

export interface Provenance {
  title: string;
  formula: string;
  inputs: Array<{ label: string; value: string }>;
  calls: NansenCallRef[];
  /** Caveats a reader needs to weigh the number correctly. */
  notes?: string[];
}

/** Whether the ⓘ receipts are shown. Off for now at the owner's request: the icons are hidden everywhere
 *  (Analyze with Nansen explains any element instead). */
export const SHOW_RECEIPTS = false;

/** Data on its way to the browser, without the receipts nobody sees: while they are off, every `provenance`
 *  field is dropped (on the overview they were a sixth of the page's data). Unchanged when they are on. */
export function forClient<T>(data: T): T {
  return SHOW_RECEIPTS ? data : (strip(data) as T);
}

function strip(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(strip);
  if (x && typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) if (k !== 'provenance') out[k] = strip(v);
    return out;
  }
  return x;
}
