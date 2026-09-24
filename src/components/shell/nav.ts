// The app's navigation, in the order a visitor meets the product: the
// radar first, then what to look at, then research and the tools that act.
// `top` items sit directly in the desktop bar (exchange style); the rest open
// from "More", grouped. Phones list everything in the drawer.
export interface NavItem { href: string; label: string; icon: NavIcon; group: 'Explore' | 'Research' | 'Act'; top?: boolean }
export type NavIcon = 'map' | 'sparkles' | 'layers' | 'activity' | 'target' | 'bot' | 'swap' | 'brain' | 'briefcase' | 'flask' | 'gauge' | 'bell' | 'key' | 'notebook';

export const NAV: NavItem[] = [
  { top: true, href: '/', label: 'Weather map', icon: 'map', group: 'Explore' },
  { top: true, href: '/alpha', label: 'Alpha', icon: 'sparkles', group: 'Explore' },
  { href: '/sectors', label: 'Sectors', icon: 'layers', group: 'Explore' },
  { top: true, href: '/perps', label: 'Perps', icon: 'activity', group: 'Explore' },
  { href: '/predict', label: 'Predictions', icon: 'target', group: 'Explore' },
  { top: true, href: '/smart-money', label: 'Smart money', icon: 'brain', group: 'Research' },
  { href: '/portfolio', label: 'Portfolio', icon: 'briefcase', group: 'Research' },
  { href: '/lab', label: 'Forecast Lab', icon: 'flask', group: 'Research' },
  { href: '/coverage', label: 'Coverage', icon: 'gauge', group: 'Research' },
  { top: true, href: '/desk', label: 'Desk', icon: 'notebook', group: 'Act' },
  { href: '/agent', label: 'Research agent', icon: 'bot', group: 'Act' },
  { href: '/alerts', label: 'Alerts', icon: 'bell', group: 'Act' },
  { top: true, href: '/trade', label: 'Trade', icon: 'swap', group: 'Act' },
  { href: '/account', label: 'Account', icon: 'key', group: 'Act' },
];
