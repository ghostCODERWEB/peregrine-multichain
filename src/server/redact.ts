// Public-mode redaction (Nansen Data Redistribution Guidelines):
// "address/labels" is prohibited in any public or customer-facing surface,
// and labels also arrive embedded in other responses (holders, traders,
// counterparties, first funders, trades). stripLabels removes every such
// field before a payload leaves the server in public mode. Our own UI
// strings that happen to be called `label` (provenance input rows, chart
// legends) live under `provenance` and are left alone.
import type { DisplayMode } from './mode';

const LABEL_KEYS = new Set([
  'label', 'walletLabel', 'nansenLabel', 'selfLabel', 'funderName',
  'address_label', 'first_funder_name', 'trader_address_label', 'counterparty_address_label',
  'from_address_label', 'to_address_label', 'wallet_label', 'owner_label', 'entity_name',
]);
const SKIP_UNDER = new Set(['provenance', 'inputs']);

export function stripLabels<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk);
    if (!v || typeof v !== 'object') return v;
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (SKIP_UNDER.has(k)) { out[k] = x; continue; }
      out[k] = LABEL_KEYS.has(k) ? null : walk(x);
    }
    return out;
  };
  return walk(value) as T;
}

export const forMode = <T,>(mode: DisplayMode, value: T): T => (mode === 'public' ? stripLabels(value) : value);

/** A section's promise, redacted before it is handed to any component. A
 *  resolved promise passed as a prop — even server to server — is written
 *  into the page's flight data in development (React's debug props), so
 *  redaction has to happen before the value becomes a prop, not inside
 *  the component that renders it. */
export const redacted = <T,>(mode: DisplayMode, p: Promise<T>): Promise<T> => p.then((v) => forMode(mode, v));

/** The sentence shown where a view is withheld from public viewers. */
export const WITHHELD = 'Shown only to the API key owner: Nansen’s redistribution rules keep smart-money trades, holdings and labels out of public views. Run TIDE with your own Nansen key to see it.';
