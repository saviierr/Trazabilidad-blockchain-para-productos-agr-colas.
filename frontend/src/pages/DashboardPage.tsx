import { Package, Ship, ShieldCheck, Sprout, Users } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard } from '@/features/dashboard/api'
import { EstadoBarChart } from '@/features/dashboard/EstadoBarChart'
import { PaisesBarChart } from '@/features/dashboard/PaisesBarChart'

export function DashboardPage() {
  const { data: resumen, isLoading, isError } = useDashboard()

  const indicadores = resumen
    ? [
        { label: 'Total de lotes', value: resumen.totalLotes, icon: Package },
        { label: 'Productores', value: resumen.totalProductores, icon: Sprout },
        { label: 'Cooperativas', value: resumen.totalCooperativas, icon: Users },
        {
          label: 'Certificados',
          value: resumen.totalCertificados,
          icon: ShieldCheck,
        },
        { label: 'Exportaciones', value: resumen.totalExportaciones, icon: Ship },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Resumen general de la trazabilidad de cacao orgánico."
      />

      {isError ? (
        <p className="text-sm text-destructive">
          No se pudieron cargar los indicadores.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-12" />
                    </CardContent>
                  </Card>
                ))
              : indicadores.map((indicador) => (
                  <Card key={indicador.label}>
                    <CardContent className="flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {indicador.label}
                        </span>
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                          <indicador.icon className="size-4" />
                        </div>
                      </div>
                      <p className="font-heading text-3xl font-semibold text-foreground">
                        {indicador.value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lotes por etapa</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <EstadoBarChart datos={resumen?.lotesPorEstado ?? []} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Exportaciones por país destino</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : (
                  <PaisesBarChart
                    datos={resumen?.exportacionesPorPais ?? []}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
