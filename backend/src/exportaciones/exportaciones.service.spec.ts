import { EstadoLote, RolNombre } from '@prisma/client';

// Ver cooperativas.service.spec.ts: evita que ExportacionesService arrastre
// el módulo real de fabric-gateway.service (y con él @hyperledger/fabric-gateway).
jest.mock('../fabric-gateway/fabric-gateway.service', () => ({
  FabricGatewayService: jest.fn(),
}));

import { ExportacionesService } from './exportaciones.service';
import { OrganizacionContextService } from '../common/organizacion-context.service';
import { FabricGatewayService } from '../fabric-gateway/fabric-gateway.service';
import { OrgChaincode } from '../fabric-gateway/types';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

describe('ExportacionesService', () => {
  let service: ExportacionesService;
  let prisma: {
    lote: { findUnique: jest.Mock; update: jest.Mock };
    exportacion: { create: jest.Mock };
    evento: { create: jest.Mock };
  };
  let fabricGateway: { submit: jest.Mock };
  let organizacionContext: { resolveExportadorId: jest.Mock };

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'exp@test.com',
    rol: RolNombre.EXPORTADOR,
    organizacionId: 'org-1',
  };

  const dto = {
    loteId: 'lote-1',
    empresaCompradora: 'Comprador SA',
    paisDestino: 'Bélgica',
    puertoSalida: 'Guayaquil',
    fechaExportacion: '2026-08-20',
  };

  beforeEach(() => {
    prisma = {
      lote: { findUnique: jest.fn(), update: jest.fn() },
      exportacion: { create: jest.fn() },
      evento: { create: jest.fn() },
    };
    fabricGateway = { submit: jest.fn() };
    organizacionContext = {
      resolveExportadorId: jest.fn().mockResolvedValue('exportador-1'),
    };

    prisma.lote.findUnique.mockResolvedValue({
      id: 'lote-1',
      estado: EstadoLote.EN_TRANSPORTE,
    });

    service = new ExportacionesService(
      prisma as unknown as PrismaService,
      organizacionContext as unknown as OrganizacionContextService,
      fabricGateway as unknown as FabricGatewayService,
    );
  });

  it('invoca RegisterExport antes de escribir en Postgres', async () => {
    fabricGateway.submit.mockResolvedValue({ transactionId: 'tx-5', result: '' });
    prisma.exportacion.create.mockResolvedValue({ id: 'exp-1' });

    await service.create(dto, user);

    expect(fabricGateway.submit).toHaveBeenCalledWith(
      OrgChaincode.EXPORTADOR,
      'RegisterExport',
      'lote-1',
      'exportador-1',
      'Bélgica',
      '2026-08-20',
    );
    expect(prisma.lote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ultimaTxHashBlockchain: 'tx-5' }),
      }),
    );
    expect(prisma.exportacion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hashTransaccionBlockchain: 'tx-5' }),
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
    expect(prisma.exportacion.create).not.toHaveBeenCalled();
  });
});
