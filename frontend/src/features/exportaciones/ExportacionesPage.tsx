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
import { useExportaciones } from './api'
import { ExportacionFormDialog } from './ExportacionFormDialog'

export function ExportacionesPage() {
  const { data: exportaciones, isLoading, isError } = useExportaciones()
  const [formAbierto, setFormAbierto] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Exportaciones
          </h2>
          <p className="text-sm text-muted-foreground">
            Registro de la salida de los lotes hacia su país de destino.
          </p>
        </div>
        <Button onClick={() => setFormAbierto(true)}>
          <Plus />
          Nueva exportación
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
