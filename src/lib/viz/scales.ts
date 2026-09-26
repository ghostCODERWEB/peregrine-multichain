// Model output -> color token. Charts reference CSS variables (var(--in-3)),
// never raw hex, so switching theme restyles every chart at once and the
// validated ramps in globals.css stay the single source of color truth.
import type { StormScoreResult } from '@/lib/models/storm-score';

export type PressureClass = 'out-4' | 'out-3' | 'out-1' | 'mid' | 'in-1' | 'in-3' | 'in-4';

/**
 * Seven diverging classes on CPI's 0-100 scale, aligned to the model's own
 * bands (below 35 low pressure, above 65 high). The neutral band 35-65 is
 * split three ways so a mild lean still shows direction without reading as
 * a pressure system. Step 2 of each arm is skipped: seven classes is the
 * ceiling before adjacent classes blur, and skipping widens the gap
 * between the neighbours that remain.
 */
export function pressureClass(cpi: number): PressureClass {
  if (cpi < 20) return 'out-4';
  if (cpi < 35) return 'out-3';
  if (cpi < 45) return 'out-1';
  if (cpi <= 55) return 'mid';
  if (cpi <= 65) return 'in-1';
  if (cpi <= 80) return 'in-3';
  return 'in-4';
}

export const PRESSURE_LEGEND: Array<{ cls: PressureClass; label: string }> = [
  { cls: 'out-4', label: '<20' },
  { cls: 'out-3', label: '20 to 35' },
  { cls: 'out-1', label: '35 to 45' },
  { cls: 'mid', label: '45 to 55' },
  { cls: 'in-1', label: '55 to 65' },
  { cls: 'in-3', label: '65 to 80' },
  { cls: 'in-4', label: '>80' },
];

export const fillVar = (cls: string) => `var(--${cls})`;
export const onFillVar = (cls: string) => `var(--on-${cls})`;

export type StormBand = StormScoreResult['band'];

export const STORM_CLASS: Record<StormBand, string> = {
  clear: 'mid',
  cloudy: 'storm-1',
  watch: 'storm-2',
  warning: 'storm-3',
};

export const STORM_LABEL: Record<StormBand, string> = {
  clear: 'Low',
  cloudy: 'Moderate',
  watch: 'High',
  warning: 'Critical',
};

/** Sign-aware class for a signed USD flow on a diverging bar (net flow
 *  charts): magnitude picks the step, sign picks the arm. */
export function flowClass(usd: number, maxAbs: number): PressureClass {
  if (usd === 0 || maxAbs === 0) return 'mid';
  const share = Math.abs(usd) / maxAbs;
  const step = share > 0.66 ? 4 : share > 0.33 ? 3 : 1;
  return `${usd > 0 ? 'in' : 'out'}-${step}` as PressureClass;
}
