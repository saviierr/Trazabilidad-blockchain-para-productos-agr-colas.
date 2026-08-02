import { EstadoLote, RolNombre } from '@prisma/client';

// Ver cooperativas.service.spec.ts: evita que TransportesService arrastre
// el módulo real de fabric-gateway.service (y con él @hyperledger/fabric-gateway).
jest.mock('../fabric-gateway/fabric-gateway.service', () => ({
  FabricGatewayService: jest.fn(),
}));

import { TransportesService } from './transportes.service';
import { OrganizacionContextService } from '../common/organizacion-context.service';
import { FabricGatewayService } from '../fabric-gateway/fabric-gateway.service';
import { OrgChaincode } from '../fabric-gateway/types';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

describe('TransportesService', () => {
  let service: TransportesService;
  let prisma: {
    lote: { findUnique: jest.Mock; update: jest.Mock };
    transporte: { create: jest.Mock };
    evento: { create: jest.Mock };
  };
  let fabricGateway: { submit: jest.Mock };
  let organizacionContext: { resolveTransportistaId: jest.Mock };

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'transp@test.com',
    rol: RolNombre.TRANSPORTISTA,
    organizacionId: 'org-1',
  };

  const dto = {
    loteId: 'lote-1',
    ruta: 'Ruta X',
    fechaSalida: '2026-08-12',
  };

  beforeEach(() => {
    prisma = {
      lote: { findUnique: jest.fn(), update: jest.fn() },
      transporte: { create: jest.fn() },
      evento: { create: jest.fn() },
    };
    fabricGateway = { submit: jest.fn() };
    organizacionContext = {
      resolveTransportistaId: jest.fn().mockResolvedValue('transportista-1'),
    };

    prisma.lote.findUnique.mockResolvedValue({
      id: 'lote-1',
      estado: EstadoLote.CERTIFICADO,
    });

    service = new TransportesService(
      prisma as unknown as PrismaService,
      organizacionContext as unknown as OrganizacionContextService,
      fabricGateway as unknown as FabricGatewayService,
    );
  });

  it('invoca RegisterTransport con la identidad TransportistaMSP antes de escribir en Postgres', async () => {
    fabricGateway.submit.mockResolvedValue({ transactionId: 'tx-4', result: '' });
    prisma.transporte.create.mockResolvedValue({ id: 'transp-1' });

    await service.create(dto, user);

    expect(fabricGateway.submit).toHaveBeenCalledWith(
      OrgChaincode.TRANSPORTISTA,
      'RegisterTransport',
      'lote-1',
      'transportista-1',
      'Ruta X',
      expect.any(String),
    );
    expect(prisma.lote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ultimaTxHashBlockchain: 'tx-4' }),
      }),
    );
    expect(fabricGateway.submit.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.lote.update.mock.invocationCallOrder[0],
    );
  });

  it('si el chaincode rechaza, no escribe nada en Postgres', async () => {
    fabricGateway.submit.mockRejectedValue(new Error('rechazado'));

    await expect(service.create(dto, user)).rejects.toThrow();
    expect(prisma.lote.update).not.toHaveBeenCalled();
    expect(prisma.transporte.create).not.toHaveBeenCalled();
  });
});
