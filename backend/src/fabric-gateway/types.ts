// WP-22 · Fabric Gateway — ver docs/WP-22-plan-fabric-gateway.md §2.1/§2.3.

export enum OrgChaincode {
  COOPERATIVA = 'cooperativa',
  CERTIFICADORA = 'certificadora',
  TRANSPORTISTA = 'transportista',
  EXPORTADOR = 'exportador',
}

// Identidad institucional compartida por tipo de organización (§2.1) — no una
// por cada fila de Organizacion en Postgres.
export const MSP_ID_BY_ORG: Record<OrgChaincode, string> = {
  [OrgChaincode.COOPERATIVA]: 'CooperativaMSP',
  [OrgChaincode.CERTIFICADORA]: 'CertificadoraMSP',
  [OrgChaincode.TRANSPORTISTA]: 'TransportistaMSP',
  [OrgChaincode.EXPORTADOR]: 'ExportadorMSP',
};

export interface FabricSubmitResult {
  transactionId: string;
  result: string;
}
