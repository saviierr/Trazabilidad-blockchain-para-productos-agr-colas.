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
import { useRegistrarExportacion } from './api'

interface ExportacionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CAMPOS_INICIALES = {
  loteId: '',
  empresaCompradora: '',
  paisDestino: '',
  puertoSalida: '',
  fechaExportacion: '',
  numeroDocumentoAduanero: '',
}

export function ExportacionFormDialog({
  open,
  onOpenChange,
}: ExportacionFormDialogProps) {
  const { data: lotes } = useLotes()
  const lotesEnTransporte = lotes?.filter((l) => l.estado === 'EN_TRANSPORTE')
  const registrar = useRegistrarExportacion()
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
        empresaCompradora: campos.empresaCompradora,
        paisDestino: campos.paisDestino,
        puertoSalida: campos.puertoSalida,
        fechaExportacion: campos.fechaExportacion,
        numeroDocumentoAduanero: campos.numeroDocumentoAduanero || undefined,
      })
      onOpenChange(false)
    } catch (err) {
      if (isAxiosError(err)) {
        const mensaje = err.response?.data?.message
        setError(
          Array.isArray(mensaje)
            ? mensaje.join(' ')
            : (mensaje ?? 'No se pudo registrar la exportación.'),
        )
      } else {
        setError('No se pudo registrar la exportación.')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva exportación</DialogTitle>
          <DialogDescription>
            Solo se pueden exportar lotes en estado En Transporte.
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
                <SelectValue placeholder="Selecciona un lote en transporte">
                  {(value: string) => {
                    const lote = lotesEnTransporte?.find((l) => l.id === value)
                    return lote
                      ? `${lote.productor.nombre} — ${new Date(lote.fechaCosecha).toLocaleDateString('es-EC')}`
                      : null
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {lotesEnTransporte && lotesEnTransporte.length > 0 ? (
                  lotesEnTransporte.map((lote) => (
                    <SelectItem key={lote.id} value={lote.id}>
                      {lote.productor.nombre} —{' '}
                      {new Date(lote.fechaCosecha).toLocaleDateString('es-EC')}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No hay lotes en transporte
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="empresaCompradora">Empresa compradora</Label>
            <Input
              id="empresaCompradora"
              required
              value={campos.empresaCompradora}
              onChange={(e) =>
                setCampos((c) => ({ ...c, empresaCompradora: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="paisDestino">País destino</Label>
            <Input
              id="paisDestino"
              required
              value={campos.paisDestino}
              onChange={(e) =>
                setCampos((c) => ({ ...c, paisDestino: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="puertoSalida">Puerto de salida</Label>
            <Input
              id="puertoSalida"
              required
              placeholder="Puerto de Guayaquil"
              value={campos.puertoSalida}
              onChange={(e) =>
                setCampos((c) => ({ ...c, puertoSalida: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fechaExportacion">Fecha de exportación</Label>
            <Input
              id="fechaExportacion"
              type="date"
              required
              value={campos.fechaExportacion}
              onChange={(e) =>
                setCampos((c) => ({ ...c, fechaExportacion: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="numeroDocumentoAduanero">
              Documento aduanero (opcional)
            </Label>
            <Input
              id="numeroDocumentoAduanero"
              value={campos.numeroDocumentoAduanero}
              onChange={(e) =>
                setCampos((c) => ({
                  ...c,
                  numeroDocumentoAduanero: e.target.value,
                }))
              }
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={registrar.isPending}>
              {registrar.isPending ? 'Registrando…' : 'Registrar exportación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
