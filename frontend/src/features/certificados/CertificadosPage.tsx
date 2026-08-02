import { useState } from 'react'
import { FileText, Plus } from 'lucide-react'
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
import { useCertificados, verPdfCertificado } from './api'
import { CertificadoFormDialog } from './CertificadoFormDialog'
import type { EstadoCertificado } from './types'

const ESTADO_VARIANT: Record<EstadoCertificado, 'default' | 'secondary' | 'destructive'> = {
  VIGENTE: 'default',
  VENCIDO: 'secondary',
  REVOCADO: 'destructive',
}

const ESTADO_LABEL: Record<EstadoCertificado, string> = {
  VIGENTE: 'Vigente',
  VENCIDO: 'Vencido',
  REVOCADO: 'Revocado',
}

export function CertificadosPage() {
  const { data: certificados, isLoading, isError } = useCertificados()
  const [formAbierto, setFormAbierto] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Certificadoras
          </h2>
          <p className="text-sm text-muted-foreground">
            Emisión y consulta de certificados de los lotes.
          </p>
        </div>
        <Button onClick={() => setFormAbierto(true)}>
          <Plus />
          Nuevo certificado
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
              No se pudieron cargar los certificados.
            </p>
          ) : certificados && certificados.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificados.map((certificado) => (
                  <TableRow key={certificado.id}>
                    <TableCell className="font-medium">
                      {certificado.lote.productor.nombre}
                    </TableCell>
                    <TableCell>{certificado.tipoCertificacion}</TableCell>
                    <TableCell>
                      {new Date(certificado.fechaEmision).toLocaleDateString(
                        'es-EC',
                      )}
                    </TableCell>
                    <TableCell>
                      {certificado.fechaVencimiento
                        ? new Date(
                            certificado.fechaVencimiento,
                          ).toLocaleDateString('es-EC')
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ESTADO_VARIANT[certificado.estado]}>
                        {ESTADO_LABEL[certificado.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => verPdfCertificado(certificado.id)}
                      >
                        <FileText />
                        Ver PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">
              Todavía no hay certificados registrados.
            </p>
          )}
        </CardContent>
      </Card>

      <CertificadoFormDialog open={formAbierto} onOpenChange={setFormAbierto} />
    </div>
  )
}
