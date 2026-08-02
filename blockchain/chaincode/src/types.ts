// WP-21 · Modelo on-chain — espejo de C2, ver docs/WP-21-plan-chaincode.md §2.2.

export enum EstadoLote {
  CREADO = 'CREADO',
  FERMENTANDO = 'FERMENTANDO',
  CERTIFICADO = 'CERTIFICADO',
  EN_TRANSPORTE = 'EN_TRANSPORTE',
  EXPORTADO = 'EXPORTADO',
}

export enum TipoEvento {
  CREACION = 'CREACION',
  FERMENTACION = 'FERMENTACION',
  CERTIFICACION = 'CERTIFICACION',
  TRANSPORTE = 'TRANSPORTE',
  EXPORTACION = 'EXPORTACION',
}

// actorMspId/actorId se derivan siempre de ctx.clientIdentity — nunca de un
// parámetro del cliente (§2.2 del plan: no se puede confiar en una firma que
// el propio llamador declara).
export interface EventoOnChain {
  tipo: TipoEvento;
  actorMspId: string;
  actorId: string;
  timestamp: string;
  datos: Record<string, unknown>;
}

export interface LoteOnChain {
  docType: 'lote';
  loteId: string;
  productorId: string;
  cooperativaId: string;
  estado: EstadoLote;
  // Snapshot al crear el lote — el chaincode no tiene acceso a Postgres para
  // consultar Productor.capacidadProductivaMaximaKg en vivo (§2.5 del plan).
  capacidadProductivaMaximaKg: number;
  pesoFermentadoKg?: number;
  hashCertificado?: string;
  firmaCertificadora?: string;
  transportistaId?: string;
  ruta?: string;
  tiempos?: string;
  exportadorId?: string;
  paisDestino?: string;
  fechaCosecha: string;
  fechaSecado?: string;
  fechaTransporte?: string;
  fechaExportacion?: string;
  historialEventos: EventoOnChain[];
}

// Orden estricto de C1 — sin saltos hacia atrás salvo corrección auditada,
// que C4 no define a nivel de chaincode (WP-15 la resolvió fuera de la cadena).
export const ORDEN_ESTADOS: EstadoLote[] = [
  EstadoLote.CREADO,
  EstadoLote.FERMENTANDO,
  EstadoLote.CERTIFICADO,
  EstadoLote.EN_TRANSPORTE,
  EstadoLote.EXPORTADO,
];
