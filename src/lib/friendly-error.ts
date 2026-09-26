// Turns raw API failures ("Nansen v1beta1/... responded 422: {...}") into one
// plain sentence for the page. The raw text stays in server logs.
export function friendlyError(raw: string): string {
  const t = raw ?? '';
  if (!/responded \d{3}|Nansen call failed|fetch failed|timeout|aborted|ECONN|\{"error"/i.test(t)) return t;
  const chain = t.match(/Invalid value '([^']+)' for body -> chain/);
  if (chain) return `Not available on ${chain[1].replace(/^./, (c) => c.toUpperCase())}: Nansen does not cover this chain for this data.`;
  if (/ 429|rate.?limit/i.test(t)) return 'Nansen is rate-limiting requests right now. Try again in a minute.';
  if (/ 40[23]|insufficient_credits|plan_upgrade/i.test(t)) return 'This Nansen data is not available on the current plan or credits.';
  if (/ 404|not_found/i.test(t)) return 'Nansen has no data for this yet.';
  if (/timeout|aborted|query_timeout| 504/i.test(t)) return 'Nansen took too long to answer. Try again shortly.';
  if (/ 5\d\d|upstream|ECONN|fetch failed/i.test(t)) return 'Nansen is temporarily unavailable. Try again shortly.';
  if (/ 422|invalid_field|missing_field/i.test(t)) return 'Nansen could not answer this request for this token or wallet.';
  return 'This data could not be loaded right now.';
}
