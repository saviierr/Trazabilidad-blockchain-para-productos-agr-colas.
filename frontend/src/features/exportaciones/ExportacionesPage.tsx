import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useExportaciones } from './api'
import { ExportacionFormDialog } from './ExportacionFormDialog'

export function ExportacionesPage() {
  const { user } = useAuth()
  const { data: exportaciones, isLoading, isError } = useExportaciones()
  const [formAbierto, setFormAbierto] = useState(false)

  // Nueva exportación: solo EXPORTADOR (ver docs/WP-15-plan-modulo-lotes.md §4.2).
  const puedeGestionar = user?.rol === 'EXPORTADOR'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exportaciones"
        description="Registro de la salida de los lotes hacia su país de destino."
        action={
          puedeGestionar && (
            <Button onClick={() => setFormAbierto(true)}>
              <Plus />
              Nueva exportación
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
              No se pudieron cargar las exportaciones.
            </p>
          ) : exportaciones && exportaciones.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Empresa compradora</TableHead>
                  <TableHead>País destino</TableHead>
                  <TableHead>Puerto de salida</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exportaciones.map((exportacion) => (
                  <TableRow key={exportacion.id}>
                    <TableCell className="font-medium">
                      {exportacion.lote.productor.nombre}
                    </TableCell>
                    <TableCell>{exportacion.empresaCompradora}</TableCell>
                    <TableCell>{exportacion.paisDestino}</TableCell>
                    <TableCell>{exportacion.puertoSalida}</TableCell>
                    <TableCell>
                      {new Date(
                        exportacion.fechaExportacion,
                      ).toLocaleDateString('es-EC')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Todavía no hay exportaciones registradas.
            </p>
          )}
        </CardContent>
      </Card>

      <ExportacionFormDialog open={formAbierto} onOpenChange={setFormAbierto} />
    </div>
  )
}
