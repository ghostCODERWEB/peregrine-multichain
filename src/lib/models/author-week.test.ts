import { describe, it, expect } from 'vitest';
import { authorWeek, type AuthorPost } from './author-week';

const post = (text: string, at = '2026-09-23T10:00:00Z', views = 100, likes = 2): AuthorPost => ({ at, text, views, likes, id: null });

describe('author week', () => {
  it('counts each cashtag once per post and ranks the breadth of tokens pushed', () => {
    const w = authorWeek('a', 'AERO', [post('$AERO $aero and $ZEC'), post('$ZEC again, $HYPE'), post('gm')]);
    expect(w.tags).toEqual([{ tag: 'ZEC', posts: 2 }, { tag: 'AERO', posts: 1 }, { tag: 'HYPE', posts: 1 }]);
    expect(w).toMatchObject({ posts: 3, distinctTags: 3, views: 300, likes: 6 });
  });
  it('mentionShare counts cashtags and bare tickers, not substrings', () => {
    expect(authorWeek('a', 'AERO', [post('AERO is up'), post('aerodrome thoughts'), post('$AERO')]).mentionShare).toBeCloseTo(2 / 3);
    expect(authorWeek('a', null, [post('$AERO')]).mentionShare).toBeNull();
  });
  it('ignores dollar amounts and keeps the five most recent posts', () => {
    const w = authorWeek('a', 'X', Array.from({ length: 7 }, (_, i) => post(`paid $5 and $1.2M ${i}`, `2026-09-1${i}T00:00:00Z`)));
    expect(w.distinctTags).toBe(0);
    expect(w.recent.map((p) => p.text.slice(-1))).toEqual(['6', '5', '4', '3', '2']);
  });
  it('handles missing reach as zero reach, not a guess', () => {
    expect(authorWeek('a', 'X', [{ at: '2026-09-23T00:00:00Z', text: '', views: null, likes: null, id: null }])).toMatchObject({ views: 0, likes: 0 });
  });
});
