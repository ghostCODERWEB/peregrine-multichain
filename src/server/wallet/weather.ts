import { addressKey } from '@/lib/address-family';
import { walletWeather, type WalletWeatherProfile, type WalletWeatherStorm } from '@/lib/models/wallet-weather';
import type { Provenance } from '@/lib/provenance';
import { pct, usd } from '@/lib/viz/format';
import { getDb } from '@/server/nansen/db';
import { isUnavailable, type Wave } from '@/server/nansen/traced';
import type { Balances, PnlSummary } from './wallet-page';

export interface WalletWeatherReading {
  profile: WalletWeatherProfile;
  provenance: Provenance;
}

interface StormRow {
  chain: string;
  token_address: string;
  score: number;
  computed_at: number;
}

export const WALLET_STORM_FRESH_MS = 48 * 3_600_000;

/** Joins already-fetched wallet sections to TIDE's local readings. */
export function walletWeatherReading(
  balances: Wave<Balances>,
  pnl: Wave<PnlSummary>,
  now = Date.now(),
): Wave<WalletWeatherReading> {
  if (isUnavailable(balances)) return { unavailable: balances.unavailable };

  const positionKeys = new Set(balances.positions.map((p) => `${p.chain}:${addressKey(p.tokenAddress)}`));
  const rows = getDb().prepare(`
    SELECT s.chain, s.token_address, s.score, s.computed_at
    FROM storm_scores s
    JOIN (
      SELECT MAX(id) AS id FROM storm_scores
      WHERE computed_at >= ? AND computed_at <= ? AND confidence >= .5
      GROUP BY chain, token_address
    ) latest ON latest.id = s.id
  `).all(now - WALLET_STORM_FRESH_MS, now) as StormRow[];
  const storms: WalletWeatherStorm[] = rows
    .filter((r) => positionKeys.has(`${r.chain}:${addressKey(r.token_address)}`))
    .map((r) => ({ chain: r.chain, tokenAddress: r.token_address, score: r.score, at: r.computed_at }));

  // A failed/unavailable PnL call is different from a confirmed zero. Do not
  // silently label that wallet a holder. With a real zero, pnl() returns a
  // summary, so the categorical rules remain evidence-backed.
  if (isUnavailable(pnl)) {
    return { unavailable: `Wallet weather needs the balance and 30-day realized-activity readings together. ${pnl.unavailable}` };
  }

  const profile = walletWeather(
    balances.positions,
    { exits: pnl.exits, tradedTokens: pnl.tokens },
    storms,
  );
  return {
    profile,
    provenance: {
      title: 'Wallet weather profile',
      formula: [
        'position share = position value ÷ priced spot balance',
        'chain share = chain value ÷ priced spot balance',
        'effective positions = 1 ÷ Σ(position share²)',
        'stable buffer = stablecoin value ÷ priced spot balance',
        'Storm exposure = Σ(score × value) ÷ scored non-stable value',
        'Storm coverage = scored non-stable value ÷ all non-stable value',
        'trader: high at ≥20 exits or ≥10 traded tokens; moderate at ≥5 or ≥3',
        'holder: high at <5 exits and ≥3 positions; moderate at <20 and ≥2 positions, or <5 exits',
      ].join('\n'),
      inputs: [
        { label: 'Priced spot balance', value: usd(profile.totalUsd) },
        { label: 'Positions', value: String(profile.positionCount) },
        { label: '30d realized exits', value: String(profile.style.activity.exits) },
        { label: 'Storm coverage', value: profile.storm.coverage == null ? 'not applicable' : pct(profile.storm.coverage, 0) },
      ],
      calls: [
        ...balances.provenance.calls,
        ...pnl.provenance.calls,
        { endpoint: 'storm_scores', body: { freshness: '48h', confidence_gte: .5, positions: 'this wallet only' }, credits: 0, ref: 'TIDE scanner history; no call at view time' },
      ],
      notes: [
        'This is a current spot snapshot plus 30-day realized activity, not a personality label, forecast or investment recommendation.',
        'Unpriced tokens, NFTs, DeFi positions and perp collateral are outside the spot total. Farmer and perp styles remain unassessed until those priced Wallet desk sections are requested.',
        'Storm scores must be newer than 48 hours and at least 50% confident. Missing scores reduce coverage; they are never treated as zero risk. Stablecoins are excluded from combined Storm exposure.',
      ],
    },
  };
}
