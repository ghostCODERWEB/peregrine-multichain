// What may be written to fixtures/ — which ship in the repo and are
// replayed in DEMO_MODE, i.e. published. Nansen's redistribution rules
// apply: prohibited and restricted data is never recorded, labels are
// stripped from everything that is.
import { ALL_LEDGER } from '@/config/endpoint-ledger';
import { stripLabels } from '@/server/redact';

const classOf = new Map(ALL_LEDGER.map((l) => [l.key.split(' ')[1].replace(/^\/api\/v1\//, '').replace(/^\/api\/(v1beta1\/)/, '$1'), l.class]));

function isSmartMoneyRequest(request: unknown): boolean {
  if (!request || typeof request !== 'object') return false;
  const r = request as Record<string, unknown>;
  const f = (r.filters ?? {}) as Record<string, unknown>;
  const labelFilter = f.include_smart_money_labels ?? r.label_type;
  return r.trader_type === 'sm' || f.trader_type === 'sm' || r.only_smart_money === true || f.only_smart_money === true
    || (Array.isArray(labelFilter) ? labelFilter.length > 0 : labelFilter === 'smart_money');
}

/** The response to record, or null when it must not be recorded at all. */
/** `publicSafe`: the caller vouches the content was built from public-view
 *  inputs only (the anchor's public-mode reports); labels are still stripped. */
export function publishableFixture(endpoint: string, request: unknown, response: unknown, publicSafe = false): unknown | null {
  const cls = classOf.get(endpoint.replace(/^\//, '')) ?? 'attribution';
  if (!publicSafe && (cls === 'prohibited' || cls === 'restricted')) return null;
  if (isSmartMoneyRequest(request)) return null; // e.g. token-screener trader_type=sm is "smart-money inflows"
  if (endpoint.startsWith('smart-alert') || endpoint.startsWith('account')) return null; // the owner's own account
  return stripLabels(response);
}

export { classOf as endpointClass };
