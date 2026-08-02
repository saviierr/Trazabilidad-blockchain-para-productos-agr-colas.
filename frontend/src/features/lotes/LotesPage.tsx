import { useState } from 'react'
import { Plus, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLotes } from './api'
import { RecepcionFormDialog } from './RecepcionFormDialog'
import { FermentacionFormDialog } from './FermentacionFormDialog'
import type { EstadoLote, Lote } from './types'

const ESTADO_LABEL: Record<EstadoLote, string> = {
  CREADO: 'Creado',
  FERMENTANDO: 'Fermentando',
  CERTIFICADO: 'Certificado',
  EN_TRANSPORTE: 'En transporte',
  EXPORTADO: 'Exportado',
}

const ESTADO_VARIANT: Record<
  EstadoLote,
  'secondary' | 'default' | 'outline'
> = {
  CREADO: 'secondary',
  FERMENTANDO: 'default',
  CERTIFICADO: 'outline',
  EN_TRANSPORTE: 'outline',
  EXPORTADO: 'outline',
}

export function LotesPage() {
  const { data: lotes, isLoading, isError } = useLotes()

  const [recepcionAbierta, setRecepcionAbierta] = useState(false)
  const [loteAFermentar, setLoteAFermentar] = useState<Lote | undefined>(
    undefined,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Lotes</h2>
          <p className="text-sm text-muted-foreground">
            Recepción, peso, fermentación y secado de los lotes de tu
            cooperativa.
          </p>
        </div>
        <Button onClick={() => setRecepcionAbierta(true)}>
          <Plus />
          Nueva recepción
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 p-6">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : isError ? (
            <p className="p-6 text-sm text-destructive">
              No se pudieron cargar los lotes.
            </p>
          ) : lotes && lotes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Productor</TableHead>
                  <TableHead>Fecha cosecha</TableHead>
                  <TableHead>Peso inicial (kg)</TableHead>
                  <TableHead>Peso fermentado (kg)</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lotes.map((lote) => (
                  <TableRow key={lote.id}>
                    <TableCell className="font-medium">
                      {lote.productor.nombre}
                    </TableCell>
                    <TableCell>
                      {new Date(lote.fechaCosecha).toLocaleDateString(
                        'es-EC',
                      )}
                    </TableCell>
                    <TableCell>{lote.pesoInicialKg ?? '—'}</TableCell>
                    <TableCell>{lote.pesoFermentadoKg ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[lote.estado]}>
                        {ESTADO_LABEL[lote.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {lote.estado === 'CREADO' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLoteAFermentar(lote)}
                        >
                          <Sprout />
                          Fermentación/secado
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Todavía no hay lotes registrados.
            </p>
          )}
        </CardContent>
      </Card>

      <RecepcionFormDialog
        open={recepcionAbierta}
        onOpenChange={setRecepcionAbierta}
      />

      <FermentacionFormDialog
        open={loteAFermentar !== undefined}
        onOpenChange={(open) => !open && setLoteAFermentar(undefined)}
        lote={loteAFermentar}
      />
    </div>
  )
}
