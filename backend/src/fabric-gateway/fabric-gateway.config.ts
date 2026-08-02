import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';
import { OrgChaincode } from './types';

export interface PeerConnectionConfig {
  peerEndpoint: string; // host:port
  tlsOrg: OrgChaincode; // organización cuyo tlsca.pem verifica ESTE peer (§2.3)
}

@Injectable()
export class FabricGatewayConfig {
  readonly channelName: string;
  readonly chaincodeName: string;
  readonly walletsPath: string;
  readonly peerConnections: Record<OrgChaincode, PeerConnectionConfig>;

  constructor(config: ConfigService) {
    this.channelName = config.get<string>(
      'FABRIC_CHANNEL_NAME',
      'canal-trazabilidad-cacao',
    );
    this.chaincodeName = config.get<string>(
      'FABRIC_CHAINCODE_NAME',
      'lote-contract',
    );
    this.walletsPath = resolve(
      process.cwd(),
      config.get<string>('FABRIC_WALLETS_PATH', '../blockchain/wallets'),
    );

    const cooperativaEndpoint = config.get<string>(
      'FABRIC_COOPERATIVA_PEER_ENDPOINT',
      'localhost:7051',
    );

    this.peerConnections = {
      [OrgChaincode.COOPERATIVA]: {
        peerEndpoint: cooperativaEndpoint,
        tlsOrg: OrgChaincode.COOPERATIVA,
      },
      [OrgChaincode.CERTIFICADORA]: {
        peerEndpoint: config.get<string>(
          'FABRIC_CERTIFICADORA_PEER_ENDPOINT',
          'localhost:9051',
        ),
        tlsOrg: OrgChaincode.CERTIFICADORA,
      },
      [OrgChaincode.EXPORTADOR]: {
        peerEndpoint: config.get<string>(
          'FABRIC_EXPORTADOR_PEER_ENDPOINT',
          'localhost:11051',
        ),
        tlsOrg: OrgChaincode.EXPORTADOR,
      },
      // TransportistaMSP no tiene peer propio (WP-20 §2.1) — envía sus
      // transacciones a través del peer de Cooperativa, firmando con su
      // propia identidad TransportistaMSP (WP-22 §2.3). No es una variable
      // de entorno independiente: es una decisión de arquitectura fija.
      [OrgChaincode.TRANSPORTISTA]: {
        peerEndpoint: cooperativaEndpoint,
        tlsOrg: OrgChaincode.COOPERATIVA,
      },
    };
  }
}
