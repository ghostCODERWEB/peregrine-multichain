// The one priced action on the home layers: a visitor's explicit click, never
// page load or polling. It makes the same cached categories call the public
// Predictions page makes on load, so the prediction layer can fill in place.
import { callNansen } from '@/server/nansen/client';
import { contextScope, type RequestContext } from '@/server/context';

export const CATEGORY_BODY = { pagination: { page: 1, per_page: 60 } };
export const CATEGORY_CREDITS = 1;

/** Always the instance key and the shared cache, which is what the layer reads.
 * A member's own key would fill their private partition, which the home layer
 * never reads or merges. Free while the 15-minute cache is fresh. */
export async function loadPredictionCategories(ctx: RequestContext) {
  const r = await contextScope.run({ ...ctx, apiKey: null }, () => callNansen<unknown>('prediction-market/categories', CATEGORY_BODY));
  return { cached: r.meta.cacheHit, credits: r.meta.cacheHit ? 0 : r.meta.creditsCost };
}
