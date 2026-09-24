// Where a points total sits on Nansen's public leaderboard. Points never
// increase with rank, so the page holding a score is found by bisection
// (about 11 pages of 1,000 for ~600K wallets). Page p holds ranks
// p·size+1 … (p+1)·size; page 0 — the top `size` ranks — can't be read.
export interface LeaderPage { total: number; rows: Array<{ points: number; rank: number; eligible: boolean }> }
export interface Standing {
  points: number; total: number;
  /** Null inside the unreadable top page. */
  rank: number | null; inTopPage: boolean; exact: boolean;
  /** Share of ranked wallets at or above this rank, 0–100. */
  topPct: number | null;
  /** Lowest points total Nansen marks eligible; null if not found. */
  eligibleFrom: number | null;
  pagesRead: number;
}

export async function findStanding(points: number, size: number, read: (page: number) => Promise<LeaderPage>): Promise<Standing> {
  const memo = new Map<number, Promise<LeaderPage>>();
  const page = (p: number) => { if (!memo.has(p)) memo.set(p, read(p)); return memo.get(p)!; };
  const first = await page(1);
  const lastPage = Math.max(1, Math.floor((first.total - 1) / size));
  const last = async (p: number) => (await page(p)).rows.at(-1);

  // Smallest page whose last row is at or below the score.
  let rank: number | null = null, exact = false;
  const inTopPage = !first.rows.length || points > first.rows[0].points;
  if (!inTopPage) {
    let lo = 1, hi = lastPage;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      const row = await last(mid);
      if (row && row.points <= points) hi = mid; else lo = mid + 1;
    }
    const at = (await page(lo)).rows.find((r) => r.points <= points);
    if (at) { rank = at.rank; exact = at.points === points; }
    else { rank = first.total; }
  }

  // Eligibility is also monotone in rank: find the last eligible row.
  let eligibleFrom: number | null = null;
  if (first.rows.some((r) => !r.eligible)) eligibleFrom = lowestEligible(first);
  else {
    let lo = 1, hi = lastPage;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if ((await last(mid))?.eligible === false) hi = mid; else lo = mid + 1;
    }
    eligibleFrom = lowestEligible(await page(lo)) ?? (lo > 1 ? (await last(lo - 1))?.points ?? null : null);
  }
  return { points, total: first.total, rank, inTopPage, exact, topPct: rank == null || !first.total ? null : Math.min(100, (rank / first.total) * 100), eligibleFrom, pagesRead: memo.size };
}

const lowestEligible = (p: LeaderPage) => {
  const rows = p.rows.filter((r) => r.eligible);
  return rows.length ? Math.min(...rows.map((r) => r.points)) : null;
};
