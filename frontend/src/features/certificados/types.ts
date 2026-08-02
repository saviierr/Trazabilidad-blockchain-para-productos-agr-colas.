export type EstadoCertificado = 'VIGENTE' | 'VENCIDO' | 'REVOCADO'

export interface Certificado {
  id: string
  loteId: string
  certificadoraId: string
  tipoCertificacion: string
  archivoPdfUrl: string
  hashArchivo: string
  fechaEmision: string
  fechaVencimiento: string | null
  estado: EstadoCertificado
  lote: {
    id: string
    estado: string
    productor: { id: string; nombre: string }
    cooperativa: { id: string; organizacion: { id: string; nombre: string } }
  }
  certificadora: {
    id: string
    organizacion: { id: string; nombre: string }
  }
  createdAt: string
}

export interface CreateCertificadoInput {
  loteId: string
  tipoCertificacion: string
  fechaEmision: string
  fechaVencimiento?: string
  archivo: File
}
