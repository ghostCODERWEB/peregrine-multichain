import { describe, it, expect } from 'vitest';
import { publicReason } from './site-text';

describe('publicReason', () => {
  it('drops the sign-in route, keeps the reason', () => {
    expect(publicReason('Shown to the API key owner or a signed-in member with their own key: Nansen does not allow its perp leaderboard in public views.'))
      .toBe('Shown to the API key owner only: Nansen does not allow its perp leaderboard in public views.');
    expect(publicReason('The smart-money desk is shown to the API key owner or a signed-in member with their own Nansen key: Nansen does not allow it.'))
      .toBe('The smart-money desk is shown to the API key owner only: Nansen does not allow it.');
    expect(publicReason('Smart-money holdings are shown to the key owner or a member with their own key only.'))
      .toBe('Smart-money holdings are shown to the key owner only.');
    expect(publicReason('Article summaries are for the key owner or a signed-in member with their own key.'))
      .toBe('Article summaries are for the key owner only.');
    expect(publicReason('Labels are withheld from public views and demo recordings: they need the owner view or a member’s own Nansen key.'))
      .toBe('Labels are withheld from public views and demo recordings: they need the owner view.');
    expect(publicReason('Built from smart-money trades, which stay out of public views. Use a Peregrine instance with your own Nansen key.'))
      .toBe('Built from smart-money trades, which stay out of public views.');
  });
  it('leaves other text alone', () => {
    const t = 'Shown only to the API key owner: Nansen’s redistribution rules keep smart-money trades out of public views.';
    expect(publicReason(t)).toBe(t);
  });
});
