// Display mode: what a given viewer may be shown, per Nansen's Data
// Redistribution Guidelines (docs/raw/guides__redistribution-guide.md).
//
//   owner  — the operator, using the instance's own key ("internal use"):
//            everything, including the scanner's smart-money history
//            (fronts, trade tape, smart-money pressure) and labels.
//   member — a signed-in user calling Nansen with THEIR OWN key: live data
//            fetched with that key is theirs to see, labels included; the
//            scanner's smart-money history (fetched with the operator's
//            key) is not, so those views stay withheld.
//   public — anyone else, and anything that leaves the app (share images,
//            the public API, MCP, demo fixtures): allowed data only, with
//            attribution, labels stripped.
//
// Owner requires TIDE_DISPLAY_MODE=private (an instance only the operator
// can reach) or a sign-in by TIDE_OWNER_ADDRESS. The Host header is never
// trusted: a remote client can set it.
import { requestContext, contextFromRequest } from './context';

export type DisplayMode = 'owner' | 'member' | 'public';
export type PressureView = 'private' | 'public';

/** Scanner-derived smart-money views are the owner's only. */
export const viewOf = (mode: DisplayMode): PressureView => (mode === 'owner' ? 'private' : 'public');

export function resolveMode(p: { demo: boolean; instancePrivate: boolean; userAddress: string | null; ownerAddress: string | null; userHasKey: boolean }): DisplayMode {
  if (p.demo) return 'public'; // demo data is published with the repo
  if (p.instancePrivate) return 'owner';
  if (p.userAddress && p.ownerAddress && p.userAddress.toLowerCase() === p.ownerAddress.toLowerCase()) return 'owner';
  if (p.userAddress && p.userHasKey) return 'member';
  return 'public';
}

/** Mode for a server component render. */
export async function displayMode(): Promise<DisplayMode> {
  return (await requestContext()).mode;
}

/** Mode for a route handler's request. */
export function modeFromRequest(req: Request): DisplayMode {
  return contextFromRequest(req).mode;
}
