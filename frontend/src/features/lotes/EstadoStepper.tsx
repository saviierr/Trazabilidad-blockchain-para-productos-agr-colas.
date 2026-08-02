import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ESTADO_LABEL, ESTADO_ORDEN } from '@/lib/estado'
import type { EstadoLote } from './types'

interface EstadoStepperProps {
  estado: EstadoLote
}

// C1: Creado → Fermentando → Certificado → En Transporte → Exportado.
// Elemento de firma del producto: una cadena de bloques literal, no un
// stepper genérico — es lo único que este dashboard tiene que ningún otro
// dashboard tiene (la cadena de custodia ES el producto). Ver
// docs/plan-rediseno-identidad-visual.md §2.4.
export function EstadoStepper({ estado }: EstadoStepperProps) {
  const indiceActual = ESTADO_ORDEN.indexOf(estado)

  return (
    <ol className="flex items-start">
      {ESTADO_ORDEN.map((paso, indice) => {
        const completado = indice < indiceActual
        const actual = indice === indiceActual

        return (
          <li
            key={paso}
            className="flex flex-1 flex-col items-center gap-1.5 last:flex-none"
          >
            <div className="flex w-full items-center">
              <div
                className={cn(
                  'flex size-5.5 shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors',
                  completado && 'border-primary bg-primary text-primary-foreground',
                  actual &&
                    'border-primary bg-card ring-4 ring-primary/15',
                  !completado && !actual && 'border-border bg-background',
                )}
              >
                {completado && <Check className="size-3" strokeWidth={3} />}
                {actual && <span className="size-1.5 rounded-[1px] bg-primary" />}
              </div>
              {indice < ESTADO_ORDEN.length - 1 && (
                <div
                  className={cn(
                    'mt-0 h-0.5 min-w-2 flex-1',
                    indice < indiceActual ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </div>
            <span
              className={cn(
                'text-center text-[10.5px] leading-tight font-semibold text-muted-foreground/80',
                actual && 'font-bold text-foreground',
              )}
            >
              {ESTADO_LABEL[paso]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
