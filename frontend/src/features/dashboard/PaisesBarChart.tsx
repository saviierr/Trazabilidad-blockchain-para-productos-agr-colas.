interface PaisesBarChartProps {
  datos: { paisDestino: string; cantidad: number }[]
}

// Mismo enfoque que EstadoBarChart: barras con Tailwind, sin librería de
// charts (ver docs/WP-16-plan-dashboard-administrativo.md §4.1).
export function PaisesBarChart({ datos }: PaisesBarChartProps) {
  if (datos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay exportaciones registradas.
      </p>
    )
  }

  const maximo = Math.max(1, ...datos.map((d) => d.cantidad))

  return (
    <div className="flex flex-col gap-3">
      {datos.map((dato) => (
        <div key={dato.paisDestino} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm text-muted-foreground">
            {dato.paisDestino}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-accent-foreground"
              style={{ width: `${(dato.cantidad / maximo) * 100}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-medium">
            {dato.cantidad}
          </span>
        </div>
      ))}
    </div>
  )
}
