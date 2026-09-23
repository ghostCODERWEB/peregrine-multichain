// The signed-in user's own Nansen API key. POST verifies it with Nansen
// (GET /api/v1/account, 0 credits) and stores it sealed; the key is never
// returned — only its last four characters and plan.
import { requireUser, sameOrigin, fail } from '@/server/auth/http';
import { saveUserKey, deleteUserKey, keyInfo } from '@/server/auth/keys';
import { vaultReady } from '@/server/auth/vault';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const ctx = requireUser(req);
  if (!ctx) return fail('Sign in first.', 401);
  return Response.json({ key: keyInfo(ctx.user!.id), vault: vaultReady(), mode: ctx.mode });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = requireUser(req);
  if (!ctx) return fail('Sign in first.', 401);
  if (!vaultReady()) return fail('This instance has no TIDE_KMS_KEY, so it cannot store API keys safely.', 503);
  const b = (await req.json().catch(() => ({}))) as { apiKey?: string };
  if (!b.apiKey) return fail('Paste your Nansen API key.');
  try { return Response.json({ key: await saveUserKey(ctx.user!.id, b.apiKey) }); } catch (e) { return fail((e as Error).message.slice(0, 200)); }
}

export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const ctx = requireUser(req);
  if (!ctx) return fail('Sign in first.', 401);
  deleteUserKey(ctx.user!.id);
  return Response.json({ ok: true });
}
