// Display mode: what a given viewer may be shown, per Nansen's Data
// Redistribution Guidelines (docs/raw/guides__redistribution-guide.md).
//
//   private — the key owner looking at their own data ("internal use"):
//             everything, including smart-money trades and labels.
//   public  — anyone else, and anything that leaves the app (share images,
//             the public API, MCP, demo fixtures): only data the guide
//             allows, with attribution; smart-money-derived views are
//             replaced (all-trader pressure) or withheld (fronts, tapes).
//
// The safe default is public. Private requires the operator to declare
// the instance private (TIDE_DISPLAY_MODE=private — a server only they can
// reach) or, once accounts land, a signed-in user using their own key.
// The Host header is never trusted for this: a remote client can set it.
import { headers } from 'next/headers';

export type DisplayMode = 'private' | 'public';

export function instanceMode(): DisplayMode {
  if (process.env.DEMO_MODE === '1') return 'public'; // demo data is published with the repo
  return process.env.TIDE_DISPLAY_MODE === 'private' ? 'private' : 'public';
}

/** Mode for a route handler's request. */
export function modeFromRequest(_req?: Request): DisplayMode {
  return instanceMode();
}

/** Mode for a server component render. */
export async function displayMode(): Promise<DisplayMode> {
  await headers(); // opt into per-request rendering; sessions will read cookies here
  return instanceMode();
}

/** Surfaces that always leave the app: never private. */
export const PUBLIC_ONLY: DisplayMode = 'public';
