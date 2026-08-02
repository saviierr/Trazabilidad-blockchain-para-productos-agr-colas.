export interface Exportacion {
  id: string
  loteId: string
  exportadorId: string
  empresaCompradora: string
  paisDestino: string
  puertoSalida: string
  fechaExportacion: string
  numeroDocumentoAduanero: string | null
  lote: {
    id: string
    estado: string
    productor: { id: string; nombre: string }
    cooperativa: { id: string; organizacion: { id: string; nombre: string } }
  }
  exportador: {
    id: string
    organizacion: { id: string; nombre: string }
  }
  createdAt: string
}

export interface CreateExportacionInput {
  loteId: string
  empresaCompradora: string
  paisDestino: string
  puertoSalida: string
  fechaExportacion: string
  numeroDocumentoAduanero?: string
}
