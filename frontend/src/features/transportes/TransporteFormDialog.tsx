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
import { useLotes } from '@/features/lotes/api'
import { useRegistrarTransporte } from './api'

interface TransporteFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CAMPOS_INICIALES = {
  loteId: '',
  ruta: '',
  fechaSalida: '',
  fechaLlegadaEstimada: '',
}

export function TransporteFormDialog({
  open,
  onOpenChange,
}: TransporteFormDialogProps) {
  const { data: lotes } = useLotes()
  const lotesCertificados = lotes?.filter((l) => l.estado === 'CERTIFICADO')
  const registrar = useRegistrarTransporte()
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

    if (!campos.loteId) {
      setError('Selecciona un lote.')
      return
    }

    try {
      await registrar.mutateAsync({
        loteId: campos.loteId,
        ruta: campos.ruta,
        fechaSalida: campos.fechaSalida,
        fechaLlegadaEstimada: campos.fechaLlegadaEstimada || undefined,
      })
      onOpenChange(false)
    } catch (err) {
      if (isAxiosError(err)) {
        const mensaje = err.response?.data?.message
        setError(
          Array.isArray(mensaje)
            ? mensaje.join(' ')
            : (mensaje ?? 'No se pudo registrar el transporte.'),
        )
      } else {
        setError('No se pudo registrar el transporte.')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo transporte</DialogTitle>
          <DialogDescription>
            Solo se pueden transportar lotes en estado Certificado.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lote">Lote</Label>
            <Select
              value={campos.loteId}
              onValueChange={(value) =>
                setCampos((c) => ({ ...c, loteId: value as string }))
              }
            >
              <SelectTrigger id="lote" className="w-full">
                <SelectValue placeholder="Selecciona un lote certificado">
                  {(value: string) => {
                    const lote = lotesCertificados?.find((l) => l.id === value)
                    return lote
                      ? `${lote.productor.nombre} — ${new Date(lote.fechaCosecha).toLocaleDateString('es-EC')}`
                      : null
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {lotesCertificados && lotesCertificados.length > 0 ? (
                  lotesCertificados.map((lote) => (
                    <SelectItem key={lote.id} value={lote.id}>
                      {lote.productor.nombre} —{' '}
                      {new Date(lote.fechaCosecha).toLocaleDateString('es-EC')}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No hay lotes certificados
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ruta">Ruta</Label>
            <Input
              id="ruta"
              required
              placeholder="Origen — destino"
              value={campos.ruta}
              onChange={(e) =>
                setCampos((c) => ({ ...c, ruta: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fechaSalida">Fecha de salida</Label>
            <Input
              id="fechaSalida"
              type="date"
              required
              value={campos.fechaSalida}
              onChange={(e) =>
                setCampos((c) => ({ ...c, fechaSalida: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fechaLlegadaEstimada">
              Llegada estimada (opcional)
            </Label>
            <Input
              id="fechaLlegadaEstimada"
              type="date"
              value={campos.fechaLlegadaEstimada}
              onChange={(e) =>
                setCampos((c) => ({
                  ...c,
                  fechaLlegadaEstimada: e.target.value,
                }))
              }
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={registrar.isPending}>
              {registrar.isPending ? 'Registrando…' : 'Registrar transporte'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
