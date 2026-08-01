import { type FormEvent, useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProductores } from '@/features/productores/api'
import { useRegistrarRecepcion } from './api'

interface RecepcionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CAMPOS_INICIALES = {
  productorId: '',
  fechaCosecha: '',
  pesoInicialKg: '',
}

export function RecepcionFormDialog({
  open,
  onOpenChange,
}: RecepcionFormDialogProps) {
  const { data: productores } = useProductores()
  const registrar = useRegistrarRecepcion()
  const [campos, setCampos] = useState(CAMPOS_INICIALES)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setCampos(CAMPOS_INICIALES)
    }
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const peso = Number(campos.pesoInicialKg)
    if (!campos.productorId) {
      setError('Selecciona un productor.')
      return
    }
    if (!Number.isFinite(peso) || peso <= 0) {
      setError('El peso debe ser un número positivo.')
      return
    }

    try {
      await registrar.mutateAsync({
        productorId: campos.productorId,
        fechaCosecha: campos.fechaCosecha,
        pesoInicialKg: peso,
      })
      onOpenChange(false)
    } catch (err) {
      if (isAxiosError(err)) {
        const mensaje = err.response?.data?.message
        setError(
          Array.isArray(mensaje)
            ? mensaje.join(' ')
            : (mensaje ?? 'No se pudo registrar la recepción.'),
        )
      } else {
        setError('No se pudo registrar la recepción.')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva recepción</DialogTitle>
          <DialogDescription>
            Registra la llegada de cacao de uno de tus productores.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="productor">Productor</Label>
            <Select
              value={campos.productorId}
              onValueChange={(value) =>
                setCampos((c) => ({ ...c, productorId: value as string }))
              }
            >
              <SelectTrigger id="productor" className="w-full">
                <SelectValue placeholder="Selecciona un productor">
                  {(value: string) => {
                    const productor = productores?.find((p) => p.id === value)
                    return productor
                      ? `${productor.nombre} — ${productor.cedula}`
                      : null
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {productores?.map((productor) => (
                  <SelectItem key={productor.id} value={productor.id}>
                    {productor.nombre} — {productor.cedula}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fechaCosecha">Fecha de cosecha</Label>
            <Input
              id="fechaCosecha"
              type="date"
              required
              value={campos.fechaCosecha}
              onChange={(e) =>
                setCampos((c) => ({ ...c, fechaCosecha: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pesoInicial">Peso recibido (kg)</Label>
            <Input
              id="pesoInicial"
              type="number"
              min="0"
              step="0.01"
              required
              value={campos.pesoInicialKg}
              onChange={(e) =>
                setCampos((c) => ({ ...c, pesoInicialKg: e.target.value }))
              }
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={registrar.isPending}>
              {registrar.isPending ? 'Registrando…' : 'Registrar recepción'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
