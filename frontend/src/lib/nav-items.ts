import {
  LayoutDashboard,
  Sprout,
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

// "Cooperativas" no tiene ítem propio: C5 no define un endpoint de consulta
// para ese módulo — sus únicas acciones (recepción, fermentación) ya viven
// dentro de la página Lotes.
export const navItems: NavItem[] = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Productores', url: '/productores', icon: Sprout },
  { title: 'Certificadoras', url: '/certificadoras', icon: ShieldCheck },
  { title: 'Transportistas', url: '/transportistas', icon: Truck },
  { title: 'Exportaciones', url: '/exportaciones', icon: Ship },
  { title: 'Lotes', url: '/lotes', icon: Package },
]
