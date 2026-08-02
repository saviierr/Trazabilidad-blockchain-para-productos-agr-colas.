import { Droplet, Ship, ShieldCheck, Sprout, Truck } from 'lucide-react'
import type { EventoPublico, TipoEvento } from './types'

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
  CORRECCION: Sprout,
}

interface HistorialTimelinePublicoProps {
  eventos: EventoPublico[]
}

// Variante pública de HistorialTimeline (WP-15): misma línea de tiempo
// visual, pero sin actorUsuario — muestra la organización y el hash de la
// transacción de cada paso (WP-23 §2.4/§2.5), no quién operó.
export function HistorialTimelinePublico({ eventos }: HistorialTimelinePublicoProps) {
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

        return (
          <li key={`${evento.tipo}-${evento.timestamp}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
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
                {evento.organizacion ?? 'Organización no disponible'}
                {' · '}
                {new Date(evento.timestamp).toLocaleString('es-EC')}
              </span>
              {evento.hashTransaccionBlockchain && (
                <span
                  className="mt-0.5 truncate font-mono text-[11px] text-ledger"
                  title={evento.hashTransaccionBlockchain}
                >
                  Tx: {evento.hashTransaccionBlockchain}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
