import { ESTADO_COLOR_CLASS, ESTADO_ICON, ESTADO_LABEL } from '@/lib/estado'
import type { EstadoLote } from './types'

interface EstadoBarChartProps {
  datos: { estado: EstadoLote; cantidad: number }[]
}

// Barras simples con Tailwind (sin librería de charts — ver
// docs/WP-16-plan-dashboard-administrativo.md §4.1), dentro de la paleta de WP-03.
export function EstadoBarChart({ datos }: EstadoBarChartProps) {
  const maximo = Math.max(1, ...datos.map((d) => d.cantidad))

  return (
    <div className="flex flex-col gap-3">
      {datos.map((dato) => {
        const Icon = ESTADO_ICON[dato.estado]
        return (
          <div key={dato.estado} className="flex items-center gap-3">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="w-28 shrink-0 text-sm text-muted-foreground">
              {ESTADO_LABEL[dato.estado]}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${ESTADO_COLOR_CLASS[dato.estado]}`}
                style={{ width: `${(dato.cantidad / maximo) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-sm font-medium">
              {dato.cantidad}
            </span>
          </div>
        )
      })}
    </div>
  )
}
