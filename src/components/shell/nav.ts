// The app's navigation, in the order a visitor meets the product: the
// radar first, then what to look at, then research and the tools that act.
export interface NavItem { href: string; label: string; icon: NavIcon; group: 'Markets' | 'Smart Money' | 'Research'; /** Not offered on a public site: owner-only data, or a wallet or paid key action. */ ownerOnly?: true; /** Other routes that belong to this item. */ also?: string[]; /** Needs a sign-in or a wallet signature: hidden when accounts are off. */ signIn?: true }

/** Pages that need a sign-in or wallet: redirected home when accounts are off. */
export const SIGN_IN_PATHS = ['/alerts', '/trade', '/account', '/login'];
/** Pages a public site redirects home (src/middleware.ts). */
export const OWNER_ONLY_PATHS = ['/smart-money', '/agent', '/alerts', '/trade'];
export type NavIcon = 'cascade' | 'copy' | 'badge' | 'shield' | 'map' | 'flows' | 'sparkles' | 'layers' | 'activity' | 'target' | 'bot' | 'swap' | 'brain' | 'briefcase' | 'flask' | 'gauge' | 'bell' | 'key' | 'notebook';

export const NAV: NavItem[] = [
  // Markets: the whole picture, what to look at, where money moves (chains, sectors), leverage, event odds.
  { href: '/', label: 'Overview', icon: 'map', group: 'Markets' },
  { href: '/alpha', label: 'Alpha', icon: 'sparkles', group: 'Markets' },
  { href: '/flows', label: 'Chain flows', icon: 'flows', group: 'Markets' },
  { href: '/sectors', label: 'Sectors', icon: 'layers', group: 'Markets' },
  { href: '/perps', label: 'Perps', icon: 'activity', group: 'Markets' },
  { href: '/predict', label: 'Predictions', icon: 'target', group: 'Markets' },
  // Smart Money: what it does, who leads it, whether you can follow it.
  { href: '/smart-money', label: 'Activity', icon: 'brain', group: 'Smart Money', ownerOnly: true },
  { href: '/cascade', label: 'Cascades', icon: 'cascade', group: 'Smart Money', ownerOnly: true },
  { href: '/copy', label: 'Copy Lab', icon: 'copy', group: 'Smart Money', ownerOnly: true },
  // Research: one token, one wallet, the past, and an analyst that reads all of it.
  { href: '/token', label: 'Token Checker', icon: 'shield', group: 'Research', also: ['/rug'] },
  { href: '/wallet', label: 'Profiler', icon: 'key', group: 'Research', also: ['/portfolio'] },
  { href: '/history', label: 'History', icon: 'gauge', group: 'Research' },
  { href: '/agent', label: 'Ask', icon: 'bot', group: 'Research', ownerOnly: true },
  { href: '/alerts', label: 'Alerts', icon: 'bell', group: 'Research', ownerOnly: true, signIn: true },
  { href: '/trade', label: 'Trade', icon: 'swap', group: 'Research', ownerOnly: true, signIn: true },
];
