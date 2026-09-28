// A small in-process fixed-window limiter for routes that reach Nansen on
// behalf of anonymous visitors (x402 quotes and paid calls), so one client
// cannot use this server to hammer Nansen. Per process; good enough for a
// single web instance.
const windows = new Map<string, { start: number; n: number }>();

export function allow(bucket: string, id: string, perMinute: number, now = Date.now()): boolean {
  const k = `${bucket}:${id}`;
  const w = windows.get(k);
  if (!w || now - w.start >= 60_000) {
    windows.set(k, { start: now, n: 1 });
    if (windows.size > 5_000) for (const [key, v] of windows) if (now - v.start >= 60_000) windows.delete(key);
    return true;
  }
  if (w.n >= perMinute) return false;
  w.n++;
  return true;
}

/** The visitor's address as the reverse proxy in front of the site reports it. Proxies append the
 *  address they saw, so the trustworthy entry is counted from the right: TRUSTED_PROXY_HOPS (default 1,
 *  one proxy such as Railway's edge) from the end. The leftmost entry is whatever the client sent and
 *  would let anyone dodge a rate limit by sending a new one each time. */
export function clientId(req: { headers: Headers }, hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1)): string {
  const chain = (req.headers.get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const n = Number.isInteger(hops) && hops >= 1 ? hops : 1;
  return chain[Math.max(0, chain.length - n)] || req.headers.get('x-real-ip') || 'direct';
}
