import { Package, Sprout, ShieldCheck, Ship, Clock } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Indicadores en placeholder — se conectan a datos reales del backend en WP-16.
const indicators = [
  { label: 'Total de lotes', value: '—', icon: Package },
  { label: 'Productores', value: '—', icon: Sprout },
  { label: 'Certificados', value: '—', icon: ShieldCheck },
  { label: 'Exportados', value: '—', icon: Ship },
  { label: 'Pendientes', value: '—', icon: Clock },
]

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-sm text-muted-foreground">
          Resumen general de la trazabilidad de cacao orgánico.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {indicators.map((indicator) => (
          <Card key={indicator.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {indicator.label}
              </CardTitle>
              <indicator.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{indicator.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Los datos reales de trazabilidad se conectarán a este panel a
            partir del Sprint 1 (módulo de Lotes y dashboard administrativo).
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
