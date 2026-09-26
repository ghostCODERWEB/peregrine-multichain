// The app's navigation, in the order a visitor meets the product: the
// radar first, then what to look at, then research and the tools that act.
export interface NavItem { href: string; label: string; icon: NavIcon; group: 'Explore' | 'Research' | 'Act'; /** Not offered on a public site: owner-only data, or a wallet or paid key action. */ ownerOnly?: true }

/** Pages a public site redirects home (src/middleware.ts). */
export const OWNER_ONLY_PATHS = ['/smart-money', '/agent', '/alerts', '/trade'];
export type NavIcon = 'shield' | 'map' | 'flows' | 'sparkles' | 'layers' | 'activity' | 'target' | 'bot' | 'swap' | 'brain' | 'briefcase' | 'flask' | 'gauge' | 'bell' | 'key' | 'notebook';

export const NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: 'map', group: 'Explore' },
  { href: '/flows', label: 'Capital Flows', icon: 'flows', group: 'Explore' },
  { href: '/alpha', label: 'Alpha', icon: 'sparkles', group: 'Explore' },
  { href: '/sectors', label: 'Sectors', icon: 'layers', group: 'Explore' },
  { href: '/perps', label: 'Perps', icon: 'activity', group: 'Explore' },
  { href: '/predict', label: 'Predictions', icon: 'target', group: 'Explore' },
  { href: '/rug', label: 'Rug Checker', icon: 'shield', group: 'Research' },
  { href: '/smart-money', label: 'Smart money', icon: 'brain', group: 'Research', ownerOnly: true },
  { href: '/wallet', label: 'Profiler', icon: 'key', group: 'Research' },
  { href: '/portfolio', label: 'Portfolio', icon: 'briefcase', group: 'Research' },
  { href: '/history', label: 'History', icon: 'gauge', group: 'Research' },
  { href: '/lab', label: 'Backtest Lab', icon: 'flask', group: 'Research' },
  { href: '/desk', label: 'Desk', icon: 'notebook', group: 'Act' },
  { href: '/agent', label: 'Ask Nansen', icon: 'bot', group: 'Act', ownerOnly: true },
  { href: '/alerts', label: 'Alerts', icon: 'bell', group: 'Act', ownerOnly: true },
  { href: '/trade', label: 'Trade', icon: 'swap', group: 'Act', ownerOnly: true },
];
