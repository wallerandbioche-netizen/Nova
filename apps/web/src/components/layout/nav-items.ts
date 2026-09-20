import { BookOpen, CandlestickChart, House, LineChart, User, type LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar. */
  compact?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Analyse IA',
    items: [
      { href: '/', label: 'Accueil', icon: House, compact: true },
      { href: '/analyser', label: 'Analyser', icon: CandlestickChart, compact: true },
      { href: '/marches', label: 'Marchés', icon: LineChart, compact: true },
    ],
  },
  {
    label: 'Suivi',
    items: [
      { href: '/journal', label: 'Journal', icon: BookOpen, compact: true },
      { href: '/profil', label: 'Profil', icon: User, compact: true },
    ],
  },
];

export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
