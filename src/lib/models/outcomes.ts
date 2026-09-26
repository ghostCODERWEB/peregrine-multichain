// Event outcomes: every market (outcome) in one Polymarket event, read together.
// For mutually exclusive outcomes (neg-risk events) the YES prices should sum
// to about 100%; the gap is the market's own over- or under-round, shown as a
// fact, not a trading suggestion. Pure; used by the market page.

export interface OutcomeLike { id: string; question: string; price: number | null; change1d: number | null; volume24h: number | null; openInterest: number | null; negRisk: boolean }

export interface OutcomeBoard {
  outcomes: Array<OutcomeLike & { share: number | null }>;
  priced: number;
  sumYes: number | null;
  /** sumYes − 1 when outcomes are mutually exclusive; null otherwise. */
  roundGap: number | null;
  leader: OutcomeLike | null;
  biggestMove: OutcomeLike | null;
}

export function outcomeBoard(markets: OutcomeLike[]): OutcomeBoard {
  const priced = markets.filter((m) => m.price != null);
  const sumYes = priced.length ? priced.reduce((a, m) => a + m.price!, 0) : null;
  const exclusive = markets.length > 1 && markets.every((m) => m.negRisk);
  const outcomes = [...markets].sort((a, b) => (b.price ?? -1) - (a.price ?? -1)).map((m) => ({ ...m, share: sumYes && m.price != null ? m.price / sumYes : null }));
  const moved = markets.filter((m) => m.change1d != null).sort((a, b) => Math.abs(b.change1d!) - Math.abs(a.change1d!))[0] ?? null;
  return { outcomes, priced: priced.length, sumYes, roundGap: exclusive && sumYes != null ? sumYes - 1 : null, leader: outcomes[0] ?? null, biggestMove: moved };
}
