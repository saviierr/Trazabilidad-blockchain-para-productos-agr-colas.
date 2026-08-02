import {
  LayoutDashboard,
  Sprout,
  Users,
  ShieldCheck,
  Truck,
  Ship,
  Package,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  url: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Productores', url: '/productores', icon: Sprout },
  { title: 'Cooperativas', url: '/cooperativas', icon: Users },
  { title: 'Certificadoras', url: '/certificadoras', icon: ShieldCheck },
  { title: 'Transportistas', url: '/transportistas', icon: Truck },
  { title: 'Exportaciones', url: '/exportaciones', icon: Ship },
  { title: 'Lotes', url: '/lotes', icon: Package },
]
