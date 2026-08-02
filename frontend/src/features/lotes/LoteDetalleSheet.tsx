import { useState } from 'react'
import { Hash, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { ESTADO_BADGE_VARIANT, ESTADO_LABEL } from '@/lib/estado'
import { useHistorialLote, useLote } from './api'
import { EditarLoteDialog } from './EditarLoteDialog'
import { EstadoStepper } from './EstadoStepper'
import { HistorialTimeline } from './HistorialTimeline'
import { QrCodeButton } from './QrCodeButton'

interface LoteDetalleSheetProps {
  loteId: string | undefined
  onOpenChange: (open: boolean) => void
}

// Vista de trazabilidad completa de un lote: stepper de estado + línea de
// tiempo del historial + certificado(s)/transporte/exportación. Ver
// docs/WP-15-plan-modulo-lotes.md §4.
export function LoteDetalleSheet({ loteId, onOpenChange }: LoteDetalleSheetProps) {
  const { user } = useAuth()
  const { data: lote, isLoading } = useLote(loteId)
  const { data: historial, isLoading: cargandoHistorial } = useHistorialLote(loteId)
  const [editarAbierto, setEditarAbierto] = useState(false)

  const puedeEditar =
    lote !== undefined &&
    (user?.rol === 'ADMIN' ||
      (user?.rol === 'COOPERATIVA' &&
        user.organizacionId === lote.cooperativa.organizacion.id))

  return (
    <Sheet open={loteId !== undefined} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Detalle del lote</SheetTitle>
          <SheetDescription>
            {lote ? `Productor: ${lote.productor.nombre}` : 'Cargando…'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-4">
          {isLoading || !lote ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 rounded-xl bg-muted p-4">
                <div className="flex items-center gap-2 rounded-md border border-border bg-ledger-soft px-3 py-2">
                  <Hash className="size-3.5 shrink-0 text-ledger" />
                  <span className="truncate font-mono text-xs font-medium text-ledger">
                    {lote.id}
                  </span>
                </div>
                <EstadoStepper estado={lote.estado} />
              </div>

              <div className="flex items-center justify-between">
                <Badge variant={ESTADO_BADGE_VARIANT[lote.estado]}>
                  {ESTADO_LABEL[lote.estado]}
                </Badge>
                <div className="flex items-center gap-2">
                  <QrCodeButton loteId={lote.id} />
                  {puedeEditar && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditarAbierto(true)}
                    >
                      <Pencil />
                      Editar
                    </Button>
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border pb-6">
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Cooperativa
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {lote.cooperativa.organizacion.nombre}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Fecha de cosecha
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {new Date(lote.fechaCosecha).toLocaleDateString('es-EC')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Peso inicial
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {lote.pesoInicialKg ?? '—'} kg
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Peso fermentado
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">
                    {lote.pesoFermentadoKg ?? '—'} kg
                  </dd>
                </div>
              </dl>

              {lote.certificados.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Certificados</h3>
                  <ul className="flex flex-col gap-2">
                    {lote.certificados.map((certificado) => (
                      <li
                        key={certificado.id}
                        className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm"
                      >
                        <span>
                          {certificado.tipoCertificacion} ·{' '}
                          {certificado.certificadora.organizacion.nombre}
                        </span>
                        <Badge
                          variant={
                            certificado.estado === 'VIGENTE'
                              ? 'default'
                              : certificado.estado === 'VENCIDO'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {certificado.estado}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {lote.transporte && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Transporte</h3>
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <p>
                      {lote.transporte.ruta} ·{' '}
                      {lote.transporte.transportista.organizacion.nombre}
                    </p>
                    <p className="text-muted-foreground">
                      Salida:{' '}
                      {new Date(lote.transporte.fechaSalida).toLocaleDateString(
                        'es-EC',
                      )}
                      {lote.transporte.fechaLlegadaReal &&
                        ` · Llegada: ${new Date(
                          lote.transporte.fechaLlegadaReal,
                        ).toLocaleDateString('es-EC')}`}
                    </p>
                    {lote.transporte.incidencias.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1">
                        {lote.transporte.incidencias.map((incidencia) => (
                          <li key={incidencia.id}>
                            <Badge variant="destructive">Incidencia</Badge>{' '}
                            <span className="text-muted-foreground">
                              {incidencia.descripcion}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              )}

              {lote.exportacion && (
                <section className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Exportación</h3>
                  <div className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <p>
                      {lote.exportacion.empresaCompradora} ·{' '}
                      {lote.exportacion.paisDestino}
                    </p>
                    <p className="text-muted-foreground">
                      {lote.exportacion.puertoSalida} ·{' '}
                      {new Date(
                        lote.exportacion.fechaExportacion,
                      ).toLocaleDateString('es-EC')}
                    </p>
                  </div>
                </section>
              )}

              <Separator />

              <section className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">Historial</h3>
                {cargandoHistorial ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <HistorialTimeline eventos={historial ?? []} />
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>

      <EditarLoteDialog
        open={editarAbierto}
        onOpenChange={setEditarAbierto}
        lote={lote}
      />
    </Sheet>
  )
}
