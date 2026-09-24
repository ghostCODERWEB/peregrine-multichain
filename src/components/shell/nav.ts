// The app's navigation, in the order a visitor meets the product: the
// weather first, then what to look at, then research and the tools that act.
export interface NavItem { href: string; label: string; icon: NavIcon; group: 'Explore' | 'Research' | 'Act' }
export type NavIcon = 'map' | 'sparkles' | 'layers' | 'activity' | 'target' | 'bot' | 'brain' | 'briefcase' | 'flask' | 'gauge' | 'bell' | 'key';

export const NAV: NavItem[] = [
  { href: '/', label: 'Weather map', icon: 'map', group: 'Explore' },
  { href: '/alpha', label: 'Alpha', icon: 'sparkles', group: 'Explore' },
  { href: '/sectors', label: 'Sectors', icon: 'layers', group: 'Explore' },
  { href: '/perps', label: 'Perps', icon: 'activity', group: 'Explore' },
  { href: '/predict', label: 'Predictions', icon: 'target', group: 'Explore' },
  { href: '/smart-money', label: 'Smart money', icon: 'brain', group: 'Research' },
  { href: '/portfolio', label: 'Portfolio', icon: 'briefcase', group: 'Research' },
  { href: '/lab', label: 'Forecast Lab', icon: 'flask', group: 'Research' },
  { href: '/coverage', label: 'Coverage', icon: 'gauge', group: 'Research' },
  { href: '/agent', label: 'Research agent', icon: 'bot', group: 'Act' },
  { href: '/alerts', label: 'Alerts', icon: 'bell', group: 'Act' },
  { href: '/account', label: 'Account', icon: 'key', group: 'Act' },
];
