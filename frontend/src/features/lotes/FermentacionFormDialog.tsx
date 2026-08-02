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
import { useRegistrarFermentacion } from './api'
import type { Lote } from './types'

interface FermentacionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lote?: Lote
}

const CAMPOS_INICIALES = { peso: '', fechaSecado: '' }

export function FermentacionFormDialog({
  open,
  onOpenChange,
  lote,
}: FermentacionFormDialogProps) {
  const registrar = useRegistrarFermentacion()
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

    if (!lote) return
    const peso = Number(campos.peso)
    if (!Number.isFinite(peso) || peso <= 0) {
      setError('El peso debe ser un número positivo.')
      return
    }

    try {
      await registrar.mutateAsync({
        loteId: lote.id,
        peso,
        fechaSecado: campos.fechaSecado,
      })
      onOpenChange(false)
    } catch (err) {
      if (isAxiosError(err)) {
        const mensaje = err.response?.data?.message
        setError(
          Array.isArray(mensaje)
            ? mensaje.join(' ')
            : (mensaje ?? 'No se pudo registrar la fermentación.'),
        )
      } else {
        setError('No se pudo registrar la fermentación.')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar fermentación y secado</DialogTitle>
          <DialogDescription>
            {lote &&
              `Lote de ${lote.productor.nombre} (recibido con ${lote.pesoInicialKg} kg).`}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="peso">Peso post-fermentación/secado (kg)</Label>
            <Input
              id="peso"
              type="number"
              min="0"
              step="0.01"
              required
              value={campos.peso}
              onChange={(e) =>
                setCampos((c) => ({ ...c, peso: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fechaSecado">Fecha de secado</Label>
            <Input
              id="fechaSecado"
              type="date"
              required
              value={campos.fechaSecado}
              onChange={(e) =>
                setCampos((c) => ({ ...c, fechaSecado: e.target.value }))
              }
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={registrar.isPending}>
              {registrar.isPending ? 'Registrando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
