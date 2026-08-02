import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ServiceError } from '@grpc/grpc-js';
import { GatewayError } from '@hyperledger/fabric-gateway';
import { FabricGatewayService } from './fabric-gateway.service';
import { FabricGatewayConfig } from './fabric-gateway.config';
import { OrgChaincode } from './types';
import * as fabricIdentity from './fabric-identity';

// WP-22 §5: unitarias con el SDK de @hyperledger/fabric-gateway mockeado —
// sin red real. La red real se ejerce en test/fabric-gateway.e2e-spec.ts.

// @grpc/grpc-js NO se mockea: connect() de @hyperledger/fabric-gateway está
// mockeado más abajo, así que el grpc.Client real que arma getContract() se
// construye pero nunca llega a emitir una llamada gRPC de verdad en estas
// pruebas — mockearlo entero rompe la carga interna de @hyperledger/fabric-protos.
const mockGatewayClose = jest.fn();

const mockContract = {
  submitAsync: jest.fn(),
  evaluateTransaction: jest.fn(),
};
const mockGateway = {
  getNetwork: jest.fn(() => ({
    getContract: jest.fn(() => mockContract),
  })),
  close: mockGatewayClose,
};
// No se usa jest.requireActual: la carga real de @hyperledger/fabric-gateway
// arrastra dependencias transitivas ESM-only (@noble/curves) que el
// transform de ts-jest no procesa. Se reimplementa un GatewayError mínimo
// pero compatible en forma (misma que usa fabric-gateway.service.ts para
// sus `instanceof`) — ambos módulos comparten esta clase mockeada.
jest.mock('@hyperledger/fabric-gateway', () => {
  class GatewayError extends Error {
    code: number;
    details: Array<{ address: string; mspId: string; message: string }>;
    cause: unknown;
    constructor(properties: {
      code: number;
      details: Array<{ address: string; mspId: string; message: string }>;
      cause: unknown;
      message?: string;
    }) {
      super(properties.message);
      this.code = properties.code;
      this.details = properties.details;
      this.cause = properties.cause;
    }
  }
  return {
    GatewayError,
    connect: jest.fn(() => mockGateway),
  };
});

jest.mock('./fabric-identity');

const mockedFabricIdentity = jest.mocked(fabricIdentity);

function fakeConfig(): FabricGatewayConfig {
  return {
    channelName: 'canal-trazabilidad-cacao',
    chaincodeName: 'lote-contract',
    walletsPath: '/fake/wallets',
    peerConnections: {
      [OrgChaincode.COOPERATIVA]: {
        peerEndpoint: 'localhost:7051',
        tlsOrg: OrgChaincode.COOPERATIVA,
      },
      [OrgChaincode.CERTIFICADORA]: {
        peerEndpoint: 'localhost:9051',
        tlsOrg: OrgChaincode.CERTIFICADORA,
      },
      [OrgChaincode.EXPORTADOR]: {
        peerEndpoint: 'localhost:11051',
        tlsOrg: OrgChaincode.EXPORTADOR,
      },
      [OrgChaincode.TRANSPORTISTA]: {
        peerEndpoint: 'localhost:7051',
        tlsOrg: OrgChaincode.COOPERATIVA,
      },
    },
  } as FabricGatewayConfig;
}

function fakeGatewayError(chaincodeMessage: string): GatewayError {
  return new GatewayError({
    code: 5,
    details: [
      {
        address: 'peer0.cooperativa.cacao.local:7051',
        mspId: 'CooperativaMSP',
        message: `chaincode response 500, ${chaincodeMessage}`,
      },
    ],
    cause: { message: 'endorsement failure' } as ServiceError,
    message: 'endorsement failure',
  });
}

function successfulCommit(transactionId: string) {
  return {
    getResult: () => Buffer.from(''),
    getStatus: jest.fn().mockResolvedValue({
      successful: true,
      transactionId,
      code: 0,
      blockNumber: 1n,
    }),
    getTransactionId: () => transactionId,
  };
}

describe('FabricGatewayService', () => {
  let service: FabricGatewayService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFabricIdentity.loadWalletIdentity.mockReturnValue({
      identity: { mspId: 'CooperativaMSP', credentials: Buffer.from('cert') },
      signer: jest.fn() as unknown as fabricIdentity.WalletIdentity['signer'],
    });
    mockedFabricIdentity.loadPeerTlsRootCert.mockReturnValue(
      Buffer.from('tlsca'),
    );
    service = new FabricGatewayService(fakeConfig());
  });

  describe('submit', () => {
    it('devuelve transactionId y result, y cachea la conexión entre llamadas', async () => {
      mockContract.submitAsync.mockResolvedValue(successfulCommit('tx-1'));

      const result = await service.submit(
        OrgChaincode.COOPERATIVA,
        'CreateLot',
        'lote-1',
        'productor-1',
        'cooperativa-1',
        '2026-08-01',
        '500',
      );

      expect(result).toEqual({ transactionId: 'tx-1', result: '' });
      expect(mockContract.submitAsync).toHaveBeenCalledWith('CreateLot', {
        arguments: ['lote-1', 'productor-1', 'cooperativa-1', '2026-08-01', '500'],
        endorsingOrganizations: ['CooperativaMSP', 'CertificadoraMSP'],
      });

      await service.submit(OrgChaincode.COOPERATIVA, 'CreateLot', 'lote-2');
      // connect() solo se invoca una vez por organización (conexión lazy cacheada, §2.2).
      const { connect } = jest.requireMock('@hyperledger/fabric-gateway');
      expect(connect).toHaveBeenCalledTimes(1);
    });

    it('lanza ConflictException si el commit no tiene éxito', async () => {
      mockContract.submitAsync.mockResolvedValue({
        getResult: () => Buffer.from(''),
        getStatus: jest
          .fn()
          .mockResolvedValue({ successful: false, transactionId: 'tx-2', code: 11 }),
        getTransactionId: () => 'tx-2',
      });

      await expect(
        service.submit(OrgChaincode.COOPERATIVA, 'CreateLot', 'lote-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('mapea "requiere <MSP>" a ForbiddenException', async () => {
      mockContract.submitAsync.mockRejectedValue(
        fakeGatewayError(
          'RegisterCertification: requiere CertificadoraMSP, la identidad que invoca pertenece a TransportistaMSP',
        ),
      );

      await expect(
        service.submit(OrgChaincode.TRANSPORTISTA, 'RegisterCertification', 'lote-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('mapea "no existe" a NotFoundException', async () => {
      mockContract.submitAsync.mockRejectedValue(
        fakeGatewayError('El lote lote-x no existe'),
      );

      await expect(
        service.submit(OrgChaincode.COOPERATIVA, 'RegisterFermentation', 'lote-x'),
      ).rejects.toThrow(NotFoundException);
    });

    it('mapea "excede la capacidad" a BadRequestException', async () => {
      mockContract.submitAsync.mockRejectedValue(
        fakeGatewayError(
          'El peso reportado (600kg) excede la capacidad productiva máxima registrada (500kg)',
        ),
      );

      await expect(
        service.submit(OrgChaincode.COOPERATIVA, 'RegisterFermentation', 'lote-1', '600'),
      ).rejects.toThrow(BadRequestException);
    });

    it('mapea "se esperaba <ESTADO>" a ConflictException', async () => {
      mockContract.submitAsync.mockRejectedValue(
        fakeGatewayError(
          'RegisterFermentation: el lote lote-1 está en estado FERMENTANDO; se esperaba CREADO',
        ),
      );

      await expect(
        service.submit(OrgChaincode.COOPERATIVA, 'RegisterFermentation', 'lote-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('mapea un fallo de conexión gRPC (sin mensaje de chaincode) a ServiceUnavailableException', async () => {
      mockContract.submitAsync.mockRejectedValue(
        new GatewayError({
          code: 14,
          details: [],
          cause: { message: 'UNAVAILABLE' } as ServiceError,
          message: 'UNAVAILABLE',
        }),
      );

      await expect(
        service.submit(OrgChaincode.COOPERATIVA, 'CreateLot', 'lote-1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('lanza ServiceUnavailableException si la wallet no existe', async () => {
      mockedFabricIdentity.loadWalletIdentity.mockImplementation(() => {
        throw new Error('ENOENT: wallet no encontrada');
      });

      await expect(
        service.submit(OrgChaincode.COOPERATIVA, 'CreateLot', 'lote-1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('evaluate', () => {
    it('devuelve el resultado decodificado como string', async () => {
      mockContract.evaluateTransaction.mockResolvedValue(
        Buffer.from('[{"tipo":"CREACION"}]'),
      );

      const result = await service.evaluate(
        OrgChaincode.COOPERATIVA,
        'GetHistory',
        'lote-1',
      );

      expect(result).toBe('[{"tipo":"CREACION"}]');
      expect(mockContract.evaluateTransaction).toHaveBeenCalledWith(
        'GetHistory',
        'lote-1',
      );
    });

    it('propaga el mismo mapeo de errores que submit', async () => {
      mockContract.evaluateTransaction.mockRejectedValue(
        fakeGatewayError('El lote lote-x no existe'),
      );

      await expect(
        service.evaluate(OrgChaincode.COOPERATIVA, 'GetHistory', 'lote-x'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('onModuleDestroy', () => {
    it('cierra las conexiones abiertas', async () => {
      mockContract.submitAsync.mockResolvedValue(successfulCommit('tx-1'));
      await service.submit(OrgChaincode.COOPERATIVA, 'CreateLot', 'lote-1');

      await service.onModuleDestroy();

      expect(mockGatewayClose).toHaveBeenCalled();
    });
  });
});
