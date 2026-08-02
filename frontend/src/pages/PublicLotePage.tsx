import { useParams } from 'react-router-dom'
import { CheckCircle2, Hash, HelpCircle, Sprout, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EstadoStepper } from '@/features/lotes/EstadoStepper'
import { HistorialTimelinePublico } from '@/features/lotes/HistorialTimelinePublico'
import { useLotePublico } from '@/features/lotes/public-api'
import { ESTADO_BADGE_VARIANT, ESTADO_LABEL } from '@/lib/estado'

// WP-23: página pública de trazabilidad — a la que apunta el QR (C6).
// Sin sesión, sin sidebar/AppLayout: es la única pantalla del sistema
// pensada para alguien que nunca inició sesión. Ver
// docs/WP-23-plan-codigo-qr.md §2.5/§2.6.
export function PublicLotePage() {
  const { id } = useParams<{ id: string }>()
  const { data: lote, isLoading, isError } = useLotePublico(id)

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center gap-2">
        <Sprout className="size-6 text-primary" />
        <div>
          <p className="font-heading text-lg font-semibold text-foreground">
            Trazabilidad del cacao
          </p>
          <p className="text-sm text-muted-foreground">
            Consulta pública — verificado en blockchain
          </p>
        </div>
      </header>

      {isLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {isError && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <XCircle className="size-8 text-destructive" />
            <p className="font-medium text-foreground">Lote no encontrado</p>
            <p className="text-sm text-muted-foreground">
              El enlace o el código QR no corresponde a ningún lote registrado.
            </p>
          </CardContent>
        </Card>
      )}

      {lote && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Lote de cacao</CardTitle>
                <Badge variant={ESTADO_BADGE_VARIANT[lote.estado]}>
                  {ESTADO_LABEL[lote.estado]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex items-center gap-2 rounded-md border border-border bg-ledger-soft px-3 py-2">
                <Hash className="size-3.5 shrink-0 text-ledger" />
                <span className="truncate font-mono text-xs font-medium text-ledger">
                  {lote.loteId}
                </span>
              </div>

              <EstadoStepper estado={lote.estado} />

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-border pb-6">
                <div>
                  <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    Cooperativa
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">{lote.cooperativa}</dd>
                </div>
                {lote.certificadora && (
                  <div>
                    <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Certificadora
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">{lote.certificadora}</dd>
                  </div>
                )}
                {lote.transportista && (
                  <div>
                    <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Transportista
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">{lote.transportista}</dd>
                  </div>
                )}
                {lote.exportador && (
                  <div>
                    <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Exportador
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">{lote.exportador}</dd>
                  </div>
                )}
                {lote.paisDestino && (
                  <div>
                    <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      País destino
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">{lote.paisDestino}</dd>
                  </div>
                )}
              </dl>

              <VerificacionBlockchain sincronizado={lote.sincronizado} />

              {lote.hashVerificacion && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    Hash de verificación (transacción de creación)
                  </span>
                  <code className="break-all rounded-md bg-ledger-soft px-2 py-1.5 font-mono text-xs text-ledger">
                    {lote.hashVerificacion}
                  </code>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historial de trazabilidad</CardTitle>
            </CardHeader>
            <CardContent>
              <HistorialTimelinePublico eventos={lote.historial} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function VerificacionBlockchain({ sincronizado }: { sincronizado: boolean | null }) {
  if (sincronizado === true) {
    return (
      <div className="flex items-center gap-2 text-sm text-foreground">
        <CheckCircle2 className="size-4 text-primary" />
        Verificado contra la blockchain — los datos coinciden con el ledger.
      </div>
    )
  }
  if (sincronizado === false) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <XCircle className="size-4" />
        Los datos no coinciden con el estado registrado en blockchain.
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <HelpCircle className="size-4" />
      No se pudo verificar en vivo contra la blockchain en este momento.
    </div>
  )
}
