// Storm alerts API. The Nansen key stays on the server; the browser only
// ever sees TIDE's own alerts with channel types, never chat ids or
// webhook URLs. State-changing methods only accept same-origin requests,
// so another site can't create alerts on this key from a visitor's browser.
import { ALL_CHAIN_IDS } from '@/lib/registry';
import { fixtureMode } from '@/server/nansen/demo';
import { contextFromRequest, contextScope, type RequestContext } from '@/server/context';
import { planStormAlerts, createAlerts, listTideAlerts, toggleAlert, deleteAlert, toChannel, type ChannelInput } from '@/server/agents/alerts';

export const dynamic = 'force-dynamic';

function sameOrigin(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = req.headers.get('origin');
  return !origin || origin === new URL(req.url).origin;
}

const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

const DEMO_NOTE = 'Smart Alerts live on a Nansen account, so DEMO_MODE can\u2019t list or create them. Run with a NANSEN_API_KEY to use storm alerts.';
const PUBLIC_NOTE = 'Smart Alerts live on a Nansen account: they are managed by this instance\u2019s owner, or by you once you sign in with your own Nansen key.';

/** Alerts act on a Nansen account: the key owner's, or a signed-in member's
 *  own. Public visitors can't list, create, toggle or delete anything. */
function account(req: Request): RequestContext | null {
  const ctx = contextFromRequest(req);
  return ctx.mode === 'public' ? null : ctx;
}

export async function GET(req: Request) {
  if (fixtureMode() === 'replay') return Response.json({ alerts: [], note: DEMO_NOTE });
  const ctx = account(req);
  if (!ctx) return Response.json({ alerts: [], note: PUBLIC_NOTE }, { status: 403 });
  try {
    return Response.json({ alerts: await contextScope.run(ctx, () => listTideAlerts()) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) {
    return fail((e as Error).message.slice(0, 200), 502);
  }
}

/** Body: { chain, address, clusterWallets?: string[], channel, dryRun?: boolean }.
 *  dryRun returns the plan (thresholds + exact requests) without creating. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = account(req);
  let body: { chain?: string; address?: string; clusterWallets?: string[]; channel?: ChannelInput; dryRun?: boolean };
  try { body = await req.json(); } catch { return fail('Expected JSON.'); }
  const { chain, address } = body;
  if (!chain || !ALL_CHAIN_IDS.includes(chain) || !address || !/^[A-Za-z0-9:._-]{20,160}$/.test(address)) return fail('Unknown chain or token.');
  try {
    const channel = body.channel ? toChannel(body.channel) : toChannel({ type: 'telegram', chatId: '0000' });
    const plan = planStormAlerts(chain, address, Array.isArray(body.clusterWallets) ? body.clusterWallets.map(String) : [], channel);
    const summary = { symbol: plan.symbol, storm: plan.storm, band: plan.band, outflowThresholdUsd: plan.outflowThresholdUsd, insiderThresholdUsd: plan.insiderThresholdUsd, insiderWallets: plan.insiderWallets, alerts: plan.requests.length, provenance: plan.provenance };
    if (body.dryRun || !body.channel) return Response.json({ plan: summary, created: 0 });
    if (fixtureMode() === 'replay') return fail(DEMO_NOTE);
    if (!ctx) return fail(PUBLIC_NOTE, 403);
    const created = await contextScope.run(ctx, () => createAlerts(plan));
    return Response.json({ plan: summary, created });
  } catch (e) {
    return fail((e as Error).message.slice(0, 240));
  }
}

export async function PATCH(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = account(req);
  if (!ctx) return fail(PUBLIC_NOTE, 403);
  const b = (await req.json().catch(() => ({}))) as { id?: string; isEnabled?: boolean };
  if (!b.id || typeof b.isEnabled !== 'boolean') return fail('Need id and isEnabled.');
  try { await contextScope.run(ctx, () => toggleAlert(b.id!, b.isEnabled!)); return Response.json({ ok: true }); } catch (e) { return fail((e as Error).message.slice(0, 200)); }
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = account(req);
  if (!ctx) return fail(PUBLIC_NOTE, 403);
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('Need id.');
  try { await contextScope.run(ctx, () => deleteAlert(id)); return Response.json({ ok: true }); } catch (e) { return fail((e as Error).message.slice(0, 200)); }
}
