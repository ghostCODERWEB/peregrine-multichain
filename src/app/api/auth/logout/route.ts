import { cookieFrom, destroySession, SESSION_COOKIE } from '@/server/auth/session';
import { sameOrigin, fail } from '@/server/auth/http';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail('Cross-site request refused.', 403);
  const id = cookieFrom(req.headers.get('cookie'));
  if (id) destroySession(id);
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } });
}
