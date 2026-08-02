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

export interface CorregirLoteInput {
  fechaCosecha?: string
  pesoInicialKg?: number
}

export type TipoEvento =
  | 'CREACION'
  | 'FERMENTACION'
  | 'CERTIFICACION'
  | 'TRANSPORTE'
  | 'EXPORTACION'
  | 'CORRECCION'

export interface Evento {
  id: string
  loteId: string
  tipo: TipoEvento
  actorUsuario: { id: string; nombre: string; email: string }
  actorOrganizacion: { id: string; nombre: string } | null
  datosEspecificos: Record<string, unknown> | null
  timestamp: string
}

export interface Certificado {
  id: string
  tipoCertificacion: string
  fechaEmision: string
  fechaVencimiento: string | null
  estado: 'VIGENTE' | 'VENCIDO' | 'REVOCADO'
  certificadora: { id: string; organizacion: { id: string; nombre: string } }
}

export interface Incidencia {
  id: string
  descripcion: string
  fecha: string
}

export interface Transporte {
  id: string
  ruta: string
  fechaSalida: string
  fechaLlegadaEstimada: string | null
  fechaLlegadaReal: string | null
  estado: 'EN_RUTA' | 'ENTREGADO'
  incidencias: Incidencia[]
  transportista: { id: string; organizacion: { id: string; nombre: string } }
}

export interface Exportacion {
  id: string
  empresaCompradora: string
  paisDestino: string
  puertoSalida: string
  fechaExportacion: string
  numeroDocumentoAduanero: string | null
  exportador: { id: string; organizacion: { id: string; nombre: string } }
}

export interface LoteDetalle extends Lote {
  certificados: Certificado[]
  transporte: Transporte | null
  exportacion: Exportacion | null
}

// WP-23 · Proyección pública (GET /public/lotes/:id, sin autenticación) —
// nunca incluye actorUsuario ni cédulas (Fase II §6/C3), a diferencia de
// Evento/LoteDetalle de arriba.
export interface EventoPublico {
  tipo: TipoEvento
  organizacion: string | null
  timestamp: string
  datos: Record<string, unknown> | null
  hashTransaccionBlockchain: string | null
}

export interface LotePublico {
  loteId: string
  estado: EstadoLote
  fechaCosecha: string
  fechaSecado: string | null
  fechaTransporte: string | null
  fechaExportacion: string | null
  cooperativa: string
  certificadora: string | null
  transportista: string | null
  exportador: string | null
  paisDestino: string | null
  hashCertificado: string | null
  hashVerificacion: string | null
  historial: EventoPublico[]
  sincronizado: boolean | null
}
