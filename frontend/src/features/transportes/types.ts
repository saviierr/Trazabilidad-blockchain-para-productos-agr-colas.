export type EstadoTransporte = 'EN_RUTA' | 'ENTREGADO'

export interface Incidencia {
  id: string
  transporteId: string
  descripcion: string
  fecha: string
  createdAt: string
}

export interface Transporte {
  id: string
  loteId: string
  transportistaId: string
  ruta: string
  fechaSalida: string
  fechaLlegadaEstimada: string | null
  fechaLlegadaReal: string | null
  estado: EstadoTransporte
  incidencias: Incidencia[]
  lote: {
    id: string
    estado: string
    productor: { id: string; nombre: string }
    cooperativa: { id: string; organizacion: { id: string; nombre: string } }
  }
  transportista: {
    id: string
    organizacion: { id: string; nombre: string }
  }
  createdAt: string
}

export interface CreateTransporteInput {
  loteId: string
  ruta: string
  fechaSalida: string
  fechaLlegadaEstimada?: string
}
