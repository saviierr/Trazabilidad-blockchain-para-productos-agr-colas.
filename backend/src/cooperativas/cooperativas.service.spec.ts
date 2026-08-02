import { BadRequestException } from '@nestjs/common';
import { EstadoLote, RolNombre } from '@prisma/client';

// El módulo real de fabric-gateway.service importa @hyperledger/fabric-gateway,
// cuyo resolvedor de Jest cae en las fuentes TS del paquete (no en dist/) y
// arrastra dependencias ESM-only (@noble/curves) que ts-jest no transforma.
// Se mockea aquí, antes de cualquier import, para que CooperativasService
// (que sí importa la clase real como valor, por la metadata de DI de Nest)
// jamás llegue a cargar el módulo real — mismo motivo que en
// fabric-gateway/fabric-gateway.service.spec.ts.
jest.mock('../fabric-gateway/fabric-gateway.service', () => ({
  FabricGatewayService: jest.fn(),
}));

import { CooperativasService } from './cooperativas.service';
import { OrganizacionContextService } from '../common/organizacion-context.service';
import { FabricGatewayService } from '../fabric-gateway/fabric-gateway.service';
import { OrgChaincode } from '../fabric-gateway/types';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

// WP-22 §5: confirma que el chaincode se invoca antes de tocar Postgres
// (§2.4) y que un rechazo aborta la escritura — con FabricGatewayService
// mockeado, sin red real.
describe('CooperativasService', () => {
  let service: CooperativasService;
  let prisma: {
    productor: { findUnique: jest.Mock };
    lote: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
    evento: { create: jest.Mock };
  };
  let fabricGateway: { submit: jest.Mock };
  let organizacionContext: { resolveCooperativaId: jest.Mock };

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'coop@test.com',
    rol: RolNombre.COOPERATIVA,
    organizacionId: 'org-1',
  };

  beforeEach(() => {
    prisma = {
      productor: { findUnique: jest.fn() },
      lote: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      evento: { create: jest.fn() },
    };
    fabricGateway = { submit: jest.fn() };
    organizacionContext = {
      resolveCooperativaId: jest.fn().mockResolvedValue('cooperativa-1'),
    };

    service = new CooperativasService(
      prisma as unknown as PrismaService,
      organizacionContext as unknown as OrganizacionContextService,
      fabricGateway as unknown as FabricGatewayService,
    );
  });

  describe('recepcion', () => {
    const dto = {
      productorId: 'productor-1',
      fechaCosecha: '2026-08-01',
      pesoInicialKg: 300,
    };

    beforeEach(() => {
      prisma.productor.findUnique.mockResolvedValue({
        id: 'productor-1',
        cooperativaId: 'cooperativa-1',
        activo: true,
        capacidadProductivaMaximaKg: { toString: () => '500' },
      });
    });

    it('invoca CreateLot antes de escribir en Postgres y guarda el transactionId', async () => {
      fabricGateway.submit.mockResolvedValue({ transactionId: 'tx-1', result: '' });
      prisma.lote.create.mockResolvedValue({ id: 'lote-1' });

      await service.recepcion(dto, user);

      expect(fabricGateway.submit).toHaveBeenCalledWith(
        OrgChaincode.COOPERATIVA,
        'CreateLot',
        expect.any(String),
        'productor-1',
        'cooperativa-1',
        '2026-08-01',
        '500',
      );
      expect(prisma.lote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ultimaTxHashBlockchain: 'tx-1' }),
        }),
      );
      expect(prisma.evento.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ hashTransaccionBlockchain: 'tx-1' }),
        }),
      );
      expect(fabricGateway.submit.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.lote.create.mock.invocationCallOrder[0],
      );
    });

    it('si el chaincode rechaza, no escribe nada en Postgres', async () => {
      fabricGateway.submit.mockRejectedValue(
        new BadRequestException('excede la capacidad'),
      );

      await expect(service.recepcion(dto, user)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.lote.create).not.toHaveBeenCalled();
      expect(prisma.evento.create).not.toHaveBeenCalled();
    });
  });

  describe('registrarFermentacion', () => {
    const dto = { loteId: 'lote-1', peso: 300, fechaSecado: '2026-08-10' };

    beforeEach(() => {
      prisma.lote.findUnique.mockResolvedValue({
        id: 'lote-1',
        cooperativaId: 'cooperativa-1',
        estado: EstadoLote.CREADO,
        productor: { capacidadProductivaMaximaKg: 500 },
      });
    });

    it('invoca RegisterFermentation antes de actualizar Postgres', async () => {
      fabricGateway.submit.mockResolvedValue({ transactionId: 'tx-2', result: '' });
      prisma.lote.update.mockResolvedValue({ id: 'lote-1' });

      await service.registrarFermentacion(dto, user);

      expect(fabricGateway.submit).toHaveBeenCalledWith(
        OrgChaincode.COOPERATIVA,
        'RegisterFermentation',
        'lote-1',
        '300',
        '2026-08-10',
      );
      expect(prisma.lote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ultimaTxHashBlockchain: 'tx-2' }),
        }),
      );
      expect(fabricGateway.submit.mock.invocationCallOrder[0]).toBeLessThan(
        prisma.lote.update.mock.invocationCallOrder[0],
      );
    });

    it('si el chaincode rechaza, no actualiza Postgres', async () => {
      fabricGateway.submit.mockRejectedValue(new Error('rechazado'));

      await expect(service.registrarFermentacion(dto, user)).rejects.toThrow();
      expect(prisma.lote.update).not.toHaveBeenCalled();
    });
  });
});
