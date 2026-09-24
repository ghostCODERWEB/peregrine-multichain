// What one social account posted in a week, read from Nansen's
// ra-agent/posts-by-user: how many posts, their reach, and how many other
// tokens the same account pushed alongside this one. A single account posting
// about fifteen tickers a week is a promoter, not a signal about any of them.
export interface AuthorPost { at: string; text: string; views: number | null; likes: number | null; id: string | null }
export interface AuthorWeek {
  username: string; posts: number; views: number; likes: number;
  /** Share of the account's posts that mention this token (cashtag or name); null without a symbol. */
  mentionShare: number | null;
  /** Distinct cashtags across the week, most-posted first. */
  tags: Array<{ tag: string; posts: number }>;
  distinctTags: number;
  recent: AuthorPost[];
}

const CASHTAG = /\$([A-Za-z][A-Za-z0-9]{1,14})\b/g;

export function authorWeek(username: string, symbol: string | null, posts: AuthorPost[]): AuthorWeek {
  const counts = new Map<string, number>();
  let mentions = 0;
  const sym = symbol?.toUpperCase() ?? null;
  for (const p of posts) {
    const tags = new Set([...p.text.matchAll(CASHTAG)].map((m) => m[1].toUpperCase()));
    for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    if (sym && (tags.has(sym) || new RegExp(`(^|[^A-Za-z0-9])${sym.replace(/[^A-Z0-9]/g, '')}([^A-Za-z0-9]|$)`, 'i').test(p.text))) mentions++;
  }
  const tags = [...counts].map(([tag, n]) => ({ tag, posts: n })).sort((a, b) => b.posts - a.posts || a.tag.localeCompare(b.tag));
  return {
    username, posts: posts.length,
    views: posts.reduce((s, p) => s + (p.views ?? 0), 0), likes: posts.reduce((s, p) => s + (p.likes ?? 0), 0),
    mentionShare: sym && posts.length ? mentions / posts.length : null,
    tags: tags.slice(0, 12), distinctTags: tags.length,
    recent: [...posts].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 5),
  };
}
