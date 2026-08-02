export type EstadoLote =
  | 'CREADO'
  | 'FERMENTANDO'
  | 'CERTIFICADO'
  | 'EN_TRANSPORTE'
  | 'EXPORTADO'

export interface ResumenDashboard {
  totalLotes: number
  totalProductores: number
  totalCooperativas: number
  totalCertificados: number
  totalExportaciones: number
  lotesPorEstado: { estado: EstadoLote; cantidad: number }[]
  exportacionesPorPais: { paisDestino: string; cantidad: number }[]
}
