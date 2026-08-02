import { useEffect, useState } from 'react'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

interface QrCodeButtonProps {
  loteId: string
}

// WP-23 §2.1: el QR se pide al backend al vuelo (GET /lotes/:id/qr) — no se
// genera en el cliente ni se guarda nada, solo se cachea el object URL
// mientras el diálogo sigue montado.
export function QrCodeButton({ loteId }: QrCodeButtonProps) {
  const [abierto, setAbierto] = useState(false)
  const [imagenUrl, setImagenUrl] = useState<string | undefined>(undefined)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    if (!abierto || imagenUrl) return
    let cancelado = false
    setCargando(true)
    api
      .get<Blob>(`/lotes/${loteId}/qr`, { responseType: 'blob' })
      .then((res) => {
        if (!cancelado) setImagenUrl(URL.createObjectURL(res.data))
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
  }, [abierto, imagenUrl, loteId])

  useEffect(() => {
    return () => {
      if (imagenUrl) URL.revokeObjectURL(imagenUrl)
    }
  }, [imagenUrl])

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
        <QrCode className="size-4" />
        Código QR
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Código QR del lote</DialogTitle>
            <DialogDescription>
              Escanéalo para abrir la consulta pública de trazabilidad de este
              lote, sin necesidad de iniciar sesión.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {cargando && <Skeleton className="size-56" />}
            {imagenUrl && (
              <>
                <img
                  src={imagenUrl}
                  alt="Código QR del lote"
                  className="size-56 rounded-md ring-1 ring-border"
                />
                <Button
                  render={
                    <a href={imagenUrl} download={`lote-${loteId}-qr.png`} />
                  }
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                >
                  Descargar PNG
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
