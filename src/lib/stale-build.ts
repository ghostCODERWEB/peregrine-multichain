// After a redeploy, a tab opened earlier asks for script chunks that no longer exist. One reload picks up
// the new build. A timestamp (not a flag) guards against a reload loop: a second deploy later in the same
// tab still reloads, but a build that keeps failing within a minute shows the error page instead.
const KEY = 'reloaded-for-build';

export function isStaleBuild(e: Error): boolean {
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(`${e.name} ${e.message}`);
}

/** Reloads once for a stale build; returns whether it did. */
export function reloadForStaleBuild(e: Error, now = Date.now()): boolean {
  if (!isStaleBuild(e)) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (now - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch { /* storage blocked: reload anyway, once per page load */ }
  location.reload();
  return true;
}
