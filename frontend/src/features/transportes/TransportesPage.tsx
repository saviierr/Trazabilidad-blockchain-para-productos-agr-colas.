import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react'
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
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/lib/auth-context'
import { useMarcarEntregado, useTransportes } from './api'
import { TransporteFormDialog } from './TransporteFormDialog'
import { IncidenciaFormDialog } from './IncidenciaFormDialog'
import type { Transporte } from './types'

export function TransportesPage() {
  const { user } = useAuth()
  const { data: transportes, isLoading, isError } = useTransportes()
  const marcarEntregado = useMarcarEntregado()

  const [formAbierto, setFormAbierto] = useState(false)
  const [transporteIncidencia, setTransporteIncidencia] = useState<
    Transporte | undefined
  >(undefined)

  // Nuevo transporte / marcar entregado / incidencia: solo TRANSPORTISTA
  // (ver docs/WP-15-plan-modulo-lotes.md §4.2).
  const puedeGestionar = user?.rol === 'TRANSPORTISTA'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transportistas"
        description="Registro de transporte, incidencias y entrega de los lotes."
        action={
          puedeGestionar && (
            <Button onClick={() => setFormAbierto(true)}>
              <Plus />
              Nuevo transporte
            </Button>
          )
        }
      />

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
              No se pudieron cargar los transportes.
            </p>
          ) : transportes && transportes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Incidencias</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transportes.map((transporte) => (
                  <TableRow key={transporte.id}>
                    <TableCell className="font-medium">
                      {transporte.lote.productor.nombre}
                    </TableCell>
                    <TableCell>{transporte.ruta}</TableCell>
                    <TableCell>
                      {new Date(transporte.fechaSalida).toLocaleDateString(
                        'es-EC',
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          transporte.estado === 'ENTREGADO'
                            ? 'default'
                            : 'secondary'
                        }
                      >
                        {transporte.estado === 'ENTREGADO'
                          ? 'Entregado'
                          : 'En ruta'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transporte.incidencias.length > 0 ? (
                        <Badge variant="destructive">
                          {transporte.incidencias.length}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {puedeGestionar && transporte.estado === 'EN_RUTA' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setTransporteIncidencia(transporte)}
                          >
                            <AlertTriangle />
                            Incidencia
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              marcarEntregado.mutate(transporte.id)
                            }
                            disabled={marcarEntregado.isPending}
                          >
                            <CheckCircle2 />
                            Marcar entregado
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Todavía no hay transportes registrados.
            </p>
          )}
        </CardContent>
      </Card>

      <TransporteFormDialog open={formAbierto} onOpenChange={setFormAbierto} />

      <IncidenciaFormDialog
        open={transporteIncidencia !== undefined}
        onOpenChange={(open) => !open && setTransporteIncidencia(undefined)}
        transporte={transporteIncidencia}
      />
    </div>
  )
}
