import { Droplet, Pencil, Ship, ShieldCheck, Sprout, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Evento, TipoEvento } from './types'

const TIPO_LABEL: Record<TipoEvento, string> = {
  CREACION: 'Recepción registrada',
  FERMENTACION: 'Fermentación / secado registrado',
  CERTIFICACION: 'Certificado emitido',
  TRANSPORTE: 'Transporte iniciado',
  EXPORTACION: 'Exportación registrada',
  CORRECCION: 'Corrección de datos',
}

const TIPO_ICON: Record<TipoEvento, typeof Sprout> = {
  CREACION: Sprout,
  FERMENTACION: Droplet,
  CERTIFICACION: ShieldCheck,
  TRANSPORTE: Truck,
  EXPORTACION: Ship,
  CORRECCION: Pencil,
}

interface HistorialTimelineProps {
  eventos: Evento[]
}

// Línea de tiempo vertical, un nodo por evento — dentro de la paleta de WP-03
// (bg-primary para eventos del proceso, bg-secondary para CORRECCION, que es
// una enmienda auditada, no un error). Ver docs/WP-15-plan-modulo-lotes.md §4.1.
export function HistorialTimeline({ eventos }: HistorialTimelineProps) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay eventos registrados para este lote.
      </p>
    )
  }

  return (
    <ol className="flex flex-col">
      {eventos.map((evento, indice) => {
        const Icon = TIPO_ICON[evento.tipo]
        const esCorreccion = evento.tipo === 'CORRECCION'

        return (
          <li key={evento.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'flex size-7 shrink-0 items-center justify-center rounded-full',
                  esCorreccion
                    ? 'bg-secondary text-secondary-foreground'
                    : 'bg-primary text-primary-foreground',
                )}
              >
                <Icon className="size-3.5" />
              </div>
              {indice < eventos.length - 1 && (
                <div className="w-px flex-1 bg-border" />
              )}
            </div>
            <div className="flex flex-col gap-0.5 pb-6">
              <span className="text-sm font-medium text-foreground">
                {TIPO_LABEL[evento.tipo]}
              </span>
              <span className="text-xs text-muted-foreground">
                {evento.actorUsuario.nombre}
                {evento.actorOrganizacion
                  ? ` · ${evento.actorOrganizacion.nombre}`
                  : ''}
                {' · '}
                {new Date(evento.timestamp).toLocaleString('es-EC')}
              </span>
              {esCorreccion && evento.datosEspecificos && (
                <CorreccionDetalle datos={evento.datosEspecificos} />
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function CorreccionDetalle({ datos }: { datos: Record<string, unknown> }) {
  const anterior = datos.anterior as Record<string, unknown> | undefined
  const nuevo = datos.nuevo as Record<string, unknown> | undefined
  if (!anterior || !nuevo) return null

  const campos = Object.keys(nuevo).filter((campo) => anterior[campo] !== nuevo[campo])
  if (campos.length === 0) return null

  return (
    <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
      {campos.map((campo) => (
        <li key={campo}>
          <span className="font-medium text-foreground">{campo}</span>:{' '}
          {String(anterior[campo])} → {String(nuevo[campo])}
        </li>
      ))}
    </ul>
  )
}
