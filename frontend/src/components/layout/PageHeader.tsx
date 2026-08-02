import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  action?: ReactNode
}

// Encabezado de página — antes duplicado idéntico en 7 páginas (Dashboard,
// Lotes, Productores, Certificadoras, Transportistas, Exportaciones,
// Próximamente). Un solo origen, y de paso el tratamiento tipográfico más
// generoso del rediseño (ver docs/plan-rediseno-identidad-visual.md).
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight text-foreground sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
