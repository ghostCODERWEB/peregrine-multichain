// ⌘K commands (L5): slash commands and a few plain-English phrasings, parsed
// in the browser and on the server alike. A command either opens an existing
// page (free) or answers inline from one priced Nansen call, run only on Enter.
export type ReplayAt = '1h' | '24h' | '7d';
export type Command =
  | { kind: 'who'; side: 'buy' | 'sell'; token: string; hours: number }
  | { kind: 'related'; address: string; chain: string | null }
  | { kind: 'replay'; token: string; at: ReplayAt }
  | { kind: 'call'; token: string }
  | { kind: 'follow'; token: string }
  | { kind: 'alert'; token: string }
  | { kind: 'ask'; token: string }
  | { kind: 'desk' }
  | { kind: 'help' };

export const COMMANDS: Array<{ usage: string; does: string; cost: string }> = [
  { usage: '/who-bought TOKEN 6h', does: 'Top buyers in a window (1h to 7d)', cost: '1 credit' },
  { usage: '/who-sold TOKEN 24h', does: 'Top sellers in a window', cost: '1 credit' },
  { usage: '/related ADDRESS [on CHAIN]', does: 'Wallets Nansen links to an address', cost: '1 credit' },
  { usage: '/replay TOKEN 24h', does: 'Open the Time Machine at T−1h, T−24h or T−7d', cost: 'opens a page' },
  { usage: '/call TOKEN', does: 'Make a call on a token', cost: 'opens a page' },
  { usage: '/follow TOKEN', does: 'Did anyone follow smart money? (owner)', cost: 'opens a page' },
  { usage: '/alert TOKEN', does: 'Alert on whale or smart-money moves', cost: 'opens a page' },
  { usage: '/ask TOKEN', does: 'Ask Nansen a research question (750 cr, confirmed)', cost: 'opens a page' },
  { usage: '/desk', does: 'Your calls and Trader DNA', cost: 'opens a page' },
];

const THIS = 'this';
const hoursOf = (n: string | undefined, unit: string | undefined): number | null => {
  if (!n) return null;
  const v = Number(n) * (/^d/i.test(unit ?? 'h') ? 24 : 1);
  return Number.isFinite(v) && v > 0 ? Math.min(168, Math.round(v)) : null;
};
const at = (s: string | undefined): ReplayAt => (s && /^(7d|7 ?days?|1w|week)$/i.test(s) ? '7d' : s && /^(1h|1 ?hours?|hour)$/i.test(s) ? '1h' : '24h');
const tok = (s: string | undefined) => (s ? s.replace(/^\$/, '').replace(/[?.!,]+$/, '') : THIS);

/** Parses a slash command or a plain-English phrasing. Null means "not a
 *  command": the input is an ordinary search. */
export function parseCommand(raw: string): Command | null {
  const s = raw.trim().replace(/\s+/g, ' ');
  if (!s) return null;
  if (/^\/(help|\?)?$/i.test(s)) return { kind: 'help' };
  let m: RegExpMatchArray | null;
  const WIN = String.raw`(?:(?:in the |over the )?(?:last|past) )?(\d+(?:\.\d+)?) ?(h|hrs?|hours?|d|days?)`;
  if ((m = s.match(new RegExp(String.raw`^/who-(bought|sold)(?: (\S+))?(?: ${WIN})?$`, 'i')))) return { kind: 'who', side: /bought/i.test(m[1]) ? 'buy' : 'sell', token: tok(m[2]), hours: hoursOf(m[3], m[4]) ?? 24 };
  if ((m = s.match(new RegExp(String.raw`^who (?:bought|is buying|was buying|(sold|is selling|was selling)) (\S+)(?: ${WIN})?\??$`, 'i')))) return { kind: 'who', side: m[1] ? 'sell' : 'buy', token: tok(m[2]), hours: hoursOf(m[3], m[4]) ?? 24 };
  if ((m = s.match(/^(?:\/related|related wallets? (?:of|for|to)|who is linked to) (\S+)(?: on (\w+))?\??$/i))) return { kind: 'related', address: m[1], chain: m[2]?.toLowerCase() ?? null };
  if ((m = s.match(/^(?:\/replay|replay|time machine(?: for)?) (\S+)(?: (?:at )?(?:t ?[-−] ?)?(1h|24h|7d|1d|1 ?hours?|1 ?days?|7 ?days?|1w|week)(?: ago)?)?$/i))) return { kind: 'replay', token: tok(m[1]), at: m[2] && /^1 ?d|^1 ?days?$/i.test(m[2]) ? '24h' : at(m[2]) };
  if ((m = s.match(/^(?:\/call|make a call on|call) (\S+)$/i))) return { kind: 'call', token: tok(m[1]) };
  if ((m = s.match(/^(?:\/follow|did anyone follow smart money on|who followed smart money on) (\S+)\??$/i))) return { kind: 'follow', token: tok(m[1]) };
  if ((m = s.match(/^(?:\/alert(?: (\S+))?|(?:fade|short|alert me on|watch) (?:(this)|\$?(\S+?)) (?:if|when) (?:whales?|smart money) (?:dump|dumps|sell|sells)\.?)$/i))) return { kind: 'alert', token: tok(m[1] ?? (m[2] ? undefined : m[3])) };
  if ((m = s.match(/^(?:\/ask|ask nansen(?: about)?) (\S+)\??$/i))) return { kind: 'ask', token: tok(m[1]) };
  if (/^(?:\/desk|my desk|my calls|trader dna)$/i.test(s)) return { kind: 'desk' };
  return null;
}

/** "this" on a token page means that token. */
export const refersToPage = (token: string) => token.toLowerCase() === THIS;
export const windowLabel = (h: number) => (h % 24 === 0 ? `${h / 24}d` : `${h}h`);
