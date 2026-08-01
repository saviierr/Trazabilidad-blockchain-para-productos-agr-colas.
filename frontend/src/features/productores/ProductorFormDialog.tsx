import { type FormEvent, useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useCreateProductor, useUpdateProductor } from './api'
import type { Productor } from './types'

interface ProductorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productor?: Productor
}

const CAMPOS_INICIALES = {
  nombre: '',
  cedula: '',
  telefono: '',
  direccion: '',
  capacidadProductivaMaximaKg: '',
}

export function ProductorFormDialog({
  open,
  onOpenChange,
  productor,
}: ProductorFormDialogProps) {
  const [campos, setCampos] = useState(CAMPOS_INICIALES)
  const [error, setError] = useState<string | null>(null)
  const crear = useCreateProductor()
  const actualizar = useUpdateProductor()
  const esEdicion = Boolean(productor)
  const guardando = crear.isPending || actualizar.isPending

  useEffect(() => {
    if (open) {
      setError(null)
      setCampos(
        productor
          ? {
              nombre: productor.nombre,
              cedula: productor.cedula,
              telefono: productor.telefono ?? '',
              direccion: productor.direccion ?? '',
              capacidadProductivaMaximaKg:
                productor.capacidadProductivaMaximaKg,
            }
          : CAMPOS_INICIALES,
      )
    }
  }, [open, productor])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const capacidad = Number(campos.capacidadProductivaMaximaKg)
    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setError('La capacidad productiva debe ser un número positivo.')
      return
    }

    try {
      if (esEdicion && productor) {
        await actualizar.mutateAsync({
          id: productor.id,
          input: {
            nombre: campos.nombre,
            telefono: campos.telefono || undefined,
            direccion: campos.direccion || undefined,
            capacidadProductivaMaximaKg: capacidad,
          },
        })
      } else {
        await crear.mutateAsync({
          nombre: campos.nombre,
          cedula: campos.cedula,
          telefono: campos.telefono || undefined,
          direccion: campos.direccion || undefined,
          capacidadProductivaMaximaKg: capacidad,
        })
      }
      onOpenChange(false)
    } catch (err) {
      if (isAxiosError(err)) {
        const mensaje = err.response?.data?.message
        setError(
          Array.isArray(mensaje)
            ? mensaje.join(' ')
            : (mensaje ?? 'No se pudo guardar el productor.'),
        )
      } else {
        setError('No se pudo guardar el productor.')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {esEdicion ? 'Editar productor' : 'Registrar productor'}
          </DialogTitle>
          <DialogDescription>
            {esEdicion
              ? 'Actualiza los datos del productor.'
              : 'Completa los datos del nuevo productor de tu cooperativa.'}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              required
              value={campos.nombre}
              onChange={(e) =>
                setCampos((c) => ({ ...c, nombre: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cedula">Cédula</Label>
            <Input
              id="cedula"
              required
              readOnly={esEdicion}
              className={esEdicion ? 'bg-muted text-muted-foreground' : undefined}
              placeholder="10 dígitos"
              value={campos.cedula}
              onChange={(e) =>
                setCampos((c) => ({ ...c, cedula: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              value={campos.telefono}
              onChange={(e) =>
                setCampos((c) => ({ ...c, telefono: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="direccion">Dirección</Label>
            <Input
              id="direccion"
              value={campos.direccion}
              onChange={(e) =>
                setCampos((c) => ({ ...c, direccion: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="capacidad">
              Capacidad productiva máxima (kg)
            </Label>
            <Input
              id="capacidad"
              type="number"
              min="0"
              step="0.01"
              required
              value={campos.capacidadProductivaMaximaKg}
              onChange={(e) =>
                setCampos((c) => ({
                  ...c,
                  capacidadProductivaMaximaKg: e.target.value,
                }))
              }
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
