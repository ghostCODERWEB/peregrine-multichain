// The app's navigation, in the order a visitor meets the product: the
// radar first, then what to look at, then research and the tools that act.
export interface NavItem { href: string; label: string; icon: NavIcon; group: 'Explore' | 'Research' | 'Act'; /** Not offered on a public site: owner-only data, or a wallet or paid key action. */ ownerOnly?: true }

/** Pages a public site redirects home (src/middleware.ts). */
export const OWNER_ONLY_PATHS = ['/smart-money', '/agent', '/alerts', '/trade'];
export type NavIcon = 'shield' | 'map' | 'flows' | 'sparkles' | 'layers' | 'activity' | 'target' | 'bot' | 'swap' | 'brain' | 'briefcase' | 'flask' | 'gauge' | 'bell' | 'key' | 'notebook';

export const NAV: NavItem[] = [
  // Intelligence: each item opens a page with live information, and the sidebar shows its status.
  { href: '/', label: 'Overview', icon: 'map', group: 'Explore' },
  { href: '/alpha', label: 'Discover', icon: 'sparkles', group: 'Explore' },
  { href: '/smart-money', label: 'Smart Money', icon: 'brain', group: 'Explore', ownerOnly: true },
  { href: '/flows', label: 'Spot flows', icon: 'flows', group: 'Explore' },
  { href: '/perps', label: 'Perps', icon: 'activity', group: 'Explore' },
  { href: '/wallet', label: 'Profiler', icon: 'key', group: 'Explore' },
  { href: '/portfolio', label: 'Portfolio', icon: 'briefcase', group: 'Explore' },
  { href: '/history', label: 'History', icon: 'gauge', group: 'Explore' },
  { href: '/sectors', label: 'Sectors', icon: 'layers', group: 'Explore' },
  // Tools: focused workflows.
  { href: '/rug', label: 'Rug Checker', icon: 'shield', group: 'Research' },
  { href: '/predict', label: 'Predictions', icon: 'target', group: 'Research' },
  { href: '/lab', label: 'Backtest Lab', icon: 'flask', group: 'Research' },
  { href: '/desk', label: 'Desk', icon: 'notebook', group: 'Research' },
  { href: '/agent', label: 'Ask Nansen', icon: 'bot', group: 'Act', ownerOnly: true },
  { href: '/alerts', label: 'Alerts', icon: 'bell', group: 'Act', ownerOnly: true },
  { href: '/trade', label: 'Trade', icon: 'swap', group: 'Act', ownerOnly: true },
  { href: '/coverage', label: 'Data coverage', icon: 'flask', group: 'Act' },
];
