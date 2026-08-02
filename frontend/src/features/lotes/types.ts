export type EstadoLote =
  | 'CREADO'
  | 'FERMENTANDO'
  | 'CERTIFICADO'
  | 'EN_TRANSPORTE'
  | 'EXPORTADO'

export interface Lote {
  id: string
  productorId: string
  cooperativaId: string
  estado: EstadoLote
  fechaCosecha: string
  fechaTransporte: string | null
  fechaExportacion: string | null
  fechaSecado: string | null
  pesoInicialKg: string | null
  pesoFermentadoKg: string | null
  productor: {
    id: string
    nombre: string
    cedula: string
  }
  cooperativa: {
    id: string
    organizacion: { id: string; nombre: string }
  }
  createdAt: string
}

export interface RecepcionLoteInput {
  productorId: string
  fechaCosecha: string
  pesoInicialKg: number
}

export interface FermentacionLoteInput {
  loteId: string
  peso: number
  fechaSecado: string
}
