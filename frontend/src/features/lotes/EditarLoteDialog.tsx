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
import { useCorregirLote } from './api'
import type { Lote } from './types'

interface EditarLoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lote?: Lote
}

// Solo corrige fechaCosecha/pesoInicialKg (los datos de la recepción) — nunca
// el estado. Ver docs/WP-15-plan-modulo-lotes.md §2.3.
export function EditarLoteDialog({
  open,
  onOpenChange,
  lote,
}: EditarLoteDialogProps) {
  const corregir = useCorregirLote()
  const [campos, setCampos] = useState({ fechaCosecha: '', pesoInicialKg: '' })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && lote) {
      setError(null)
      setCampos({
        fechaCosecha: lote.fechaCosecha.slice(0, 10),
        pesoInicialKg: lote.pesoInicialKg ?? '',
      })
    }
  }, [open, lote])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (!lote) return
    const pesoInicialKg = Number(campos.pesoInicialKg)
    if (!Number.isFinite(pesoInicialKg) || pesoInicialKg <= 0) {
      setError('El peso inicial debe ser un número positivo.')
      return
    }

    try {
      await corregir.mutateAsync({
        id: lote.id,
        input: { fechaCosecha: campos.fechaCosecha, pesoInicialKg },
      })
      onOpenChange(false)
    } catch (err) {
      if (isAxiosError(err)) {
        const mensaje = err.response?.data?.message
        setError(
          Array.isArray(mensaje)
            ? mensaje.join(' ')
            : (mensaje ?? 'No se pudo corregir el lote.'),
        )
      } else {
        setError('No se pudo corregir el lote.')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Corregir datos de recepción</DialogTitle>
          <DialogDescription>
            {lote &&
              `Lote de ${lote.productor.nombre}. La corrección queda auditada como un evento nuevo — el estado del lote no cambia.`}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
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
            <Label htmlFor="pesoInicialKg">Peso inicial (kg)</Label>
            <Input
              id="pesoInicialKg"
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
            <Button type="submit" disabled={corregir.isPending}>
              {corregir.isPending ? 'Guardando…' : 'Guardar corrección'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
