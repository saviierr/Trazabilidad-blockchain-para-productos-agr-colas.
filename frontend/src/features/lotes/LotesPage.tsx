import { useMemo, useState } from 'react'
import { Eye, Hash, Plus, Search, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth-context'
import { ESTADO_BADGE_VARIANT, ESTADO_LABEL } from '@/lib/estado'
import { useLotes } from './api'
import { EstadoStepper } from './EstadoStepper'
import { RecepcionFormDialog } from './RecepcionFormDialog'
import { FermentacionFormDialog } from './FermentacionFormDialog'
import { LoteDetalleSheet } from './LoteDetalleSheet'
import type { Lote } from './types'

export function LotesPage() {
  const { user } = useAuth()
  const { data: lotes, isLoading, isError } = useLotes()
  const [busqueda, setBusqueda] = useState('')

  const [recepcionAbierta, setRecepcionAbierta] = useState(false)
  const [loteAFermentar, setLoteAFermentar] = useState<Lote | undefined>(
    undefined,
  )
  const [loteDetalleId, setLoteDetalleId] = useState<string | undefined>(
    undefined,
  )

  // Nueva recepción / fermentación-secado: solo COOPERATIVA (ver
  // docs/WP-15-plan-modulo-lotes.md §4.2).
  const puedeGestionar = user?.rol === 'COOPERATIVA'

  const lotesFiltrados = useMemo(() => {
    if (!lotes) return []
    const consulta = busqueda.trim().toLowerCase()
    if (!consulta) return lotes
    return lotes.filter(
      (lote) =>
        lote.productor.nombre.toLowerCase().includes(consulta) ||
        lote.id.toLowerCase().includes(consulta),
    )
  }, [lotes, busqueda])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lotes"
        description="Recepción, peso, fermentación y secado de los lotes de tu cooperativa."
        action={
          puedeGestionar && (
            <Button onClick={() => setRecepcionAbierta(true)}>
              <Plus />
              Nueva recepción
            </Button>
          )
        }
      />

      {!isLoading && !isError && lotes && lotes.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            placeholder="Buscar por productor o ID de lote…"
            className="h-9 w-full rounded-full border border-border bg-card pr-4 pl-9 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex flex-col gap-4">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          No se pudieron cargar los lotes.
        </p>
      ) : lotesFiltrados.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {lotesFiltrados.map((lote) => (
            <LoteCard
              key={lote.id}
              lote={lote}
              puedeGestionar={puedeGestionar}
              onVerDetalle={() => setLoteDetalleId(lote.id)}
              onFermentar={() => setLoteAFermentar(lote)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Sprout className="size-8 text-muted-foreground" />
            <p className="font-medium text-foreground">
              {busqueda ? 'Sin resultados' : 'Todavía no hay lotes registrados'}
            </p>
            <p className="text-sm text-muted-foreground">
              {busqueda
                ? 'Prueba con otro nombre de productor o ID de lote.'
                : puedeGestionar
                  ? 'Registra la primera recepción para empezar a trazar un lote.'
                  : 'Los lotes de tu cooperativa aparecerán aquí.'}
            </p>
          </CardContent>
        </Card>
      )}

      <RecepcionFormDialog
        open={recepcionAbierta}
        onOpenChange={setRecepcionAbierta}
      />

      <FermentacionFormDialog
        open={loteAFermentar !== undefined}
        onOpenChange={(open) => !open && setLoteAFermentar(undefined)}
        lote={loteAFermentar}
      />

      <LoteDetalleSheet
        loteId={loteDetalleId}
        onOpenChange={(open) => !open && setLoteDetalleId(undefined)}
      />
    </div>
  )
}

interface LoteCardProps {
  lote: Lote
  puedeGestionar: boolean
  onVerDetalle: () => void
  onFermentar: () => void
}

// Tarjeta de lote — reemplaza la tabla plana anterior. Muestra de un vistazo
// lo que antes exigía leer una fila: estado, quién/cuándo, el ID (ledger,
// WP-23) y el avance real en la cadena de custodia.
function LoteCard({ lote, puedeGestionar, onVerDetalle, onFermentar }: LoteCardProps) {
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-lg hover:ring-primary/25"
      onClick={onVerDetalle}
    >
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Badge variant={ESTADO_BADGE_VARIANT[lote.estado]}>
              {ESTADO_LABEL[lote.estado]}
            </Badge>
            <p className="mt-2 font-heading text-lg font-semibold text-foreground">
              {lote.productor.nombre}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Cooperativa
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {lote.cooperativa.organizacion.nombre}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Fecha de cosecha
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {new Date(lote.fechaCosecha).toLocaleDateString('es-EC')}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Peso inicial
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {lote.pesoInicialKg ?? '—'} kg
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              Peso fermentado
            </p>
            <p className="mt-0.5 text-sm font-medium text-foreground">
              {lote.pesoFermentadoKg ?? '—'} kg
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border bg-ledger-soft px-3 py-2">
          <Hash className="size-3.5 shrink-0 text-ledger" />
          <span className="truncate font-mono text-xs font-medium text-ledger">
            {lote.id}
          </span>
        </div>

        <EstadoStepper estado={lote.estado} />

        <div
          className="flex gap-2 border-t border-border pt-4"
          onClick={(evento) => evento.stopPropagation()}
        >
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onVerDetalle}
          >
            <Eye />
            Ver detalle
          </Button>
          {puedeGestionar && lote.estado === 'CREADO' && (
            <Button size="sm" className="flex-1" onClick={onFermentar}>
              <Sprout />
              Fermentación/secado
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
