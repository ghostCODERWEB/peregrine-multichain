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

export function clientId(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
}
