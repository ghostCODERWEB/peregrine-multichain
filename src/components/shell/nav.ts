// The app's navigation, in the order a visitor meets the product: the
// radar first, then what to look at, then research and the tools that act.
export interface NavItem { href: string; label: string; icon: NavIcon; group: 'Explore' | 'Research' | 'Act'; /** Not offered on a public site: owner-only data, or a wallet or paid key action. */ ownerOnly?: true; /** Other routes that belong to this item. */ also?: string[]; /** Needs a sign-in or a wallet signature: hidden when accounts are off. */ signIn?: true }

/** Pages that need a sign-in or wallet: redirected home when accounts are off. */
export const SIGN_IN_PATHS = ['/alerts', '/trade', '/account', '/login'];
/** Pages a public site redirects home (src/middleware.ts). */
export const OWNER_ONLY_PATHS = ['/smart-money', '/agent', '/alerts', '/trade'];
export type NavIcon = 'badge' | 'shield' | 'map' | 'flows' | 'sparkles' | 'layers' | 'activity' | 'target' | 'bot' | 'swap' | 'brain' | 'briefcase' | 'flask' | 'gauge' | 'bell' | 'key' | 'notebook';

export const NAV: NavItem[] = [
  // Markets, in a trader's reading order: the whole picture, what to look at, who is moving,
  // where money goes between chains, leverage, event odds, then sector baskets.
  { href: '/', label: 'Overview', icon: 'map', group: 'Explore' },
  { href: '/alpha', label: 'Alpha', icon: 'sparkles', group: 'Explore' },
  { href: '/smart-money', label: 'Smart Money', icon: 'brain', group: 'Explore', ownerOnly: true },
  { href: '/flows', label: 'Chain flows', icon: 'flows', group: 'Explore' },
  { href: '/perps', label: 'Perps', icon: 'activity', group: 'Explore' },
  { href: '/predict', label: 'Predictions', icon: 'target', group: 'Explore' },
  { href: '/sectors', label: 'Sectors', icon: 'layers', group: 'Explore' },
  // Research: a wallet, a basket of wallets, the past, a token's risk, a strategy.
  { href: '/wallet', label: 'Profiler', icon: 'key', group: 'Research', also: ['/portfolio'] },
  { href: '/history', label: 'History', icon: 'gauge', group: 'Research' },
  { href: '/token', label: 'Token Checker', icon: 'shield', group: 'Research', also: ['/rug'] },
  { href: '/lab', label: 'Backtest Lab', icon: 'flask', group: 'Research' },
  { href: '/proof', label: 'Proof', icon: 'badge', group: 'Research' },
  { href: '/agent', label: 'Ask Nansen', icon: 'bot', group: 'Act', ownerOnly: true },
  { href: '/alerts', label: 'Alerts', icon: 'bell', group: 'Act', ownerOnly: true, signIn: true },
  { href: '/trade', label: 'Trade', icon: 'swap', group: 'Act', ownerOnly: true, signIn: true },
];
