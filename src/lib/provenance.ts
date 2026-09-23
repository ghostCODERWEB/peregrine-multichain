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
