// Builds the ⓘ trace for the numbers the weather map shows, next to where
// they're computed.
import type { Provenance } from '@/lib/provenance';
import type { ChainWeather, Front, PressureForecast } from './queries';
import { screenerRequestBody, DEX_TRADES_REQUEST } from './scanner';
import { usd, num, ago } from '@/lib/viz/format';

export function cpiProvenance(w: ChainWeather): Provenance | null {
  if (w.cpi == null || !w.source) return null;
  const sm = w.source === 'smart-money';
  const notes: string[] = [];
  if (w.anyCrossSection) {
    notes.push(
      `z is taken against ${sm ? 'other smart-money chains' : 'other market-flow chains'} right now, not this chain's own history, the scanner keeps 8+ snapshots with some spread before switching to "unusual for this chain".`,
    );
  }
  if (!sm) {
    notes.push(
      `All-trader flow: Nansen returns no smart-money or whale rows for ${w.chain} (checked live), so this reads all-trader net flow. Weaker signal; not comparable to smart-money chains.`,
    );
  }
  const quiet = w.windows.filter((x) => sm && x.tokenCount === 0).map((x) => x.window);
  if (quiet.length) notes.push(`No smart-money trades on ${w.chain} in the ${quiet.join(', ')} window, recorded as zero flow, which is a reading, not missing data.`);

  return {
    title: `Flow Index, ${w.chain}`,
    formula:
      'r = net_flow / max(volume, $10K)\n' +
      'z = (r − median) / (1.4826·MAD)   [history or peers]\n' +
      'CPI_w = 50 + 50·tanh(z/2)\n' +
      'Flow = 0.2·Flow_1h + 0.5·Flow_24h + 0.3·Flow_7d',
    inputs: w.windows.flatMap((x) => [
      { label: `${x.window} net flow (${x.tokenCount} tokens)`, value: usd(x.netFlowUsd, { signed: true }) },
      { label: `${x.window} volume`, value: usd(x.volumeUsd) },
      { label: `${x.window} r · z · Flow`, value: `${x.ratio.toExponential(2)} · ${num(x.z, 2)} · ${num(x.cpi)}` },
    ]).concat([{ label: 'Blended Flow Index', value: num(w.cpi) }, { label: 'Updated', value: ago(w.updatedAt) }]),
    calls: [
      ...(sm ? [{ endpoint: 'token-screener', body: screenerRequestBody([w.chain], '24h', true), credits: 1, ref: 'net flow · batched ≤5 chains per call' }] : []),
      { endpoint: 'token-screener', body: screenerRequestBody([w.chain], '24h', false), credits: 1, ref: `volume${sm ? '' : ' + net flow'} · one call per window (1h, 24h, 7d)` },
    ],
    notes,
  };
}

export function frontProvenance(f: Front, hours = 24): Provenance {
  return {
    title: `Capital rotation ${f.from} → ${f.to}`,
    formula:
      'per wallet: a sell on A (risk → stable/native) matched to\n' +
      '  its largest later buy on B (stable/native → risk) within 12h,\n' +
      '  each buy claimed at most once\n' +
      'R(A→B) = Σ min(sold_usd, bought_usd)\n' +
      'net = R(A→B) − R(B→A)    confidence = 1 − exp(−wallets/3)',
    inputs: [
      { label: `R(${f.from}→${f.to})`, value: usd(f.grossForward) },
      { label: `R(${f.to}→${f.from})`, value: usd(f.grossBack) },
      { label: 'Net rotation', value: usd(f.netUsd) },
      { label: 'Wallets', value: String(f.walletCount) },
      { label: 'Confidence', value: num(f.confidence, 2) },
    ],
    calls: [{ endpoint: 'smart-money/dex-trades', body: DEX_TRADES_REQUEST, credits: 5, ref: `captured every scan into smart_money_trades; trailing ${hours}h + 12h matching window` }],
    notes: [
      'These are observed same-address matches. Distinct-wallet funding hypotheses live in the separate Inferred rotations section and use dashed arcs only when explicitly enabled. Neither is proof of a bridge transfer.',
    ],
  };
}

export function forecastProvenance(f: PressureForecast): Provenance {
  return {
    title: `24h flow projection, ${f.chain}`,
    formula:
      'Holt linear smoothing on blended Flow Index snapshots\n' +
      'level_t = α·y_t + (1−α)(level + trend)\n' +
      'trend_t = β·(level_t − level) + (1−β)·trend\n' +
      'fan = ±1.28·σ_resid·√h  (80%)',
    inputs: f.insufficient
      ? [{ label: 'Snapshots so far', value: String(f.sampleSize) }]
      : [
        { label: 'α, β (grid-searched)', value: `${num(f.alpha, 2)}, ${num(f.beta, 2)}` },
        { label: 'Snapshots used', value: String(f.sampleSize) },
        { label: 'Step', value: `${f.stepMinutes} min` },
        { label: 'In-sample MAPE', value: f.mape == null ? 'n/a' : `${num(f.mape)}%` },
      ],
    calls: [],
    notes: [
      f.insufficient
        ? `Needs 12 snapshots of history before a trend means anything; the scanner adds one every scan interval.`
        : 'MAPE here is in-sample one-step error. Out-of-sample accuracy is in the Backtest Lab.',
    ],
  };
}
