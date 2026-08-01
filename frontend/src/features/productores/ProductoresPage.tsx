import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDeleteProductor, useProductores } from './api'
import { ProductorFormDialog } from './ProductorFormDialog'
import type { Productor } from './types'

export function ProductoresPage() {
  const { data: productores, isLoading, isError } = useProductores()
  const eliminar = useDeleteProductor()

  const [formAbierto, setFormAbierto] = useState(false)
  const [productorEnEdicion, setProductorEnEdicion] = useState<
    Productor | undefined
  >(undefined)
  const [productorAEliminar, setProductorAEliminar] =
    useState<Productor | null>(null)

  function abrirCreacion() {
    setProductorEnEdicion(undefined)
    setFormAbierto(true)
  }

  function abrirEdicion(productor: Productor) {
    setProductorEnEdicion(productor)
    setFormAbierto(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Productores
          </h2>
          <p className="text-sm text-muted-foreground">
            Gestión de los productores de cacao afiliados a tu cooperativa.
          </p>
        </div>
        <Button onClick={abrirCreacion}>
          <Plus />
          Nuevo productor
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
              No se pudieron cargar los productores.
            </p>
          ) : productores && productores.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Cooperativa</TableHead>
                  <TableHead>Capacidad (kg)</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productores.map((productor) => (
                  <TableRow key={productor.id}>
                    <TableCell className="font-medium">
                      {productor.nombre}
                    </TableCell>
                    <TableCell>{productor.cedula}</TableCell>
                    <TableCell>
                      {productor.cooperativa.organizacion.nombre}
                    </TableCell>
                    <TableCell>
                      {productor.capacidadProductivaMaximaKg}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={productor.activo ? 'default' : 'secondary'}
                      >
                        {productor.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => abrirEdicion(productor)}
                      >
                        <Pencil />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setProductorAEliminar(productor)}
                      >
                        <Trash2 />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Todavía no hay productores registrados.
            </p>
          )}
        </CardContent>
      </Card>

      <ProductorFormDialog
        open={formAbierto}
        onOpenChange={setFormAbierto}
        productor={productorEnEdicion}
      />

      <AlertDialog
        open={productorAEliminar !== null}
        onOpenChange={(open) => !open && setProductorAEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar productor?</AlertDialogTitle>
            <AlertDialogDescription>
              {productorAEliminar?.nombre} quedará marcado como inactivo
              (eliminación lógica) y dejará de aparecer en el listado. Esta
              acción se puede revertir desde la base de datos si es
              necesario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (productorAEliminar) {
                  eliminar.mutate(productorAEliminar.id)
                  setProductorAEliminar(null)
                }
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
