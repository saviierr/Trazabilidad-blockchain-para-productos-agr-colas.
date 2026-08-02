import { type FormEvent, useEffect, useRef, useState } from 'react'
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
import { useEmitirCertificado } from './api'

interface CertificadoFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CAMPOS_INICIALES = {
  loteId: '',
  tipoCertificacion: '',
  fechaEmision: '',
  fechaVencimiento: '',
}

export function CertificadoFormDialog({
  open,
  onOpenChange,
}: CertificadoFormDialogProps) {
  const { data: lotes } = useLotes()
  const lotesFermentando = lotes?.filter((l) => l.estado === 'FERMENTANDO')
  const emitir = useEmitirCertificado()
  const [campos, setCampos] = useState(CAMPOS_INICIALES)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setError(null)
      setCampos(CAMPOS_INICIALES)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const archivo = fileInputRef.current?.files?.[0]
    if (!campos.loteId) {
      setError('Selecciona un lote.')
      return
    }
    if (!archivo) {
      setError('Adjunta el PDF del certificado.')
      return
    }
    if (archivo.type !== 'application/pdf') {
      setError('El archivo debe ser un PDF.')
      return
    }

    try {
      await emitir.mutateAsync({
        loteId: campos.loteId,
        tipoCertificacion: campos.tipoCertificacion,
        fechaEmision: campos.fechaEmision,
        fechaVencimiento: campos.fechaVencimiento || undefined,
        archivo,
      })
      onOpenChange(false)
    } catch (err) {
      if (isAxiosError(err)) {
        const mensaje = err.response?.data?.message
        setError(
          Array.isArray(mensaje)
            ? mensaje.join(' ')
            : (mensaje ?? 'No se pudo emitir el certificado.'),
        )
      } else {
        setError('No se pudo emitir el certificado.')
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo certificado</DialogTitle>
          <DialogDescription>
            Solo se pueden certificar lotes en estado Fermentando.
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
                <SelectValue placeholder="Selecciona un lote en Fermentando">
                  {(value: string) => {
                    const lote = lotesFermentando?.find((l) => l.id === value)
                    return lote
                      ? `${lote.productor.nombre} — ${new Date(lote.fechaCosecha).toLocaleDateString('es-EC')}`
                      : null
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {lotesFermentando && lotesFermentando.length > 0 ? (
                  lotesFermentando.map((lote) => (
                    <SelectItem key={lote.id} value={lote.id}>
                      {lote.productor.nombre} —{' '}
                      {new Date(lote.fechaCosecha).toLocaleDateString('es-EC')}
                    </SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    No hay lotes en Fermentando
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tipoCertificacion">Tipo de certificación</Label>
            <Input
              id="tipoCertificacion"
              required
              placeholder="Orgánico, Fair Trade…"
              value={campos.tipoCertificacion}
              onChange={(e) =>
                setCampos((c) => ({ ...c, tipoCertificacion: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fechaEmision">Fecha de emisión</Label>
            <Input
              id="fechaEmision"
              type="date"
              required
              value={campos.fechaEmision}
              onChange={(e) =>
                setCampos((c) => ({ ...c, fechaEmision: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fechaVencimiento">
              Fecha de vencimiento (opcional)
            </Label>
            <Input
              id="fechaVencimiento"
              type="date"
              value={campos.fechaVencimiento}
              onChange={(e) =>
                setCampos((c) => ({ ...c, fechaVencimiento: e.target.value }))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="archivo">Archivo PDF</Label>
            <Input
              id="archivo"
              type="file"
              accept="application/pdf"
              required
              ref={fileInputRef}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={emitir.isPending}>
              {emitir.isPending ? 'Emitiendo…' : 'Emitir certificado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
