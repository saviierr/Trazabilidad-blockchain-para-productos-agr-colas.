import { EstadoLote, RolNombre } from '@prisma/client';

// Ver cooperativas.service.spec.ts: evita que CertificadosService arrastre
// el módulo real de fabric-gateway.service (y con él @hyperledger/fabric-gateway).
jest.mock('../fabric-gateway/fabric-gateway.service', () => ({
  FabricGatewayService: jest.fn(),
}));
// create() escribe el PDF a disco (WP-12 §2.1) — se sobrescriben solo esas
// dos funciones (Prisma Client usa el resto del módulo fs internamente al
// cargar, así que no puede reemplazarse por completo).
jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

import { CertificadosService } from './certificados.service';
import { OrganizacionContextService } from '../common/organizacion-context.service';
import { FabricGatewayService } from '../fabric-gateway/fabric-gateway.service';
import { OrgChaincode } from '../fabric-gateway/types';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

describe('CertificadosService', () => {
  let service: CertificadosService;
  let prisma: {
    lote: { findUnique: jest.Mock; update: jest.Mock };
    certificado: { create: jest.Mock };
    evento: { create: jest.Mock };
  };
  let fabricGateway: { submit: jest.Mock };
  let organizacionContext: { resolveCertificadoraId: jest.Mock };

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'cert@test.com',
    rol: RolNombre.CERTIFICADORA,
    organizacionId: 'org-1',
  };

  const archivo = {
    mimetype: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%fake\n%%EOF'),
  } as Express.Multer.File;

  const dto = {
    loteId: 'lote-1',
    tipoCertificacion: 'Organico',
    fechaEmision: '2026-08-05',
  };

  beforeEach(() => {
    // mkdirSync/writeFileSync son jest.fn() a nivel de módulo (compartidos
    // entre pruebas por el factory de jest.mock) — hay que limpiarlos aquí,
    // si no el conteo de llamadas se arrastra de una prueba a otra.
    const fs = jest.requireMock('node:fs') as {
      mkdirSync: jest.Mock;
      writeFileSync: jest.Mock;
    };
    fs.mkdirSync.mockClear();
    fs.writeFileSync.mockClear();

    prisma = {
      lote: { findUnique: jest.fn(), update: jest.fn() },
      certificado: { create: jest.fn() },
      evento: { create: jest.fn() },
    };
    fabricGateway = { submit: jest.fn() };
    organizacionContext = {
      resolveCertificadoraId: jest.fn().mockResolvedValue('certificadora-1'),
    };

    prisma.lote.findUnique.mockResolvedValue({
      id: 'lote-1',
      estado: EstadoLote.FERMENTANDO,
    });

    service = new CertificadosService(
      prisma as unknown as PrismaService,
      organizacionContext as unknown as OrganizacionContextService,
      fabricGateway as unknown as FabricGatewayService,
    );
  });

  it('invoca RegisterCertification (con el hash como firma, §2.7) antes de escribir en Postgres', async () => {
    fabricGateway.submit.mockResolvedValue({ transactionId: 'tx-3', result: '' });
    prisma.certificado.create.mockResolvedValue({ id: 'cert-1' });

    await service.create(dto, archivo, user);

    expect(fabricGateway.submit).toHaveBeenCalledWith(
      OrgChaincode.CERTIFICADORA,
      'RegisterCertification',
      'lote-1',
      expect.any(String),
      expect.any(String),
    );
    const [, , , hashArg, firmaArg] = fabricGateway.submit.mock.calls[0];
    expect(hashArg).toBe(firmaArg); // §2.7: mismo hash SHA-256 reutilizado como firma

    expect(prisma.lote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ultimaTxHashBlockchain: 'tx-3' }),
      }),
    );
    expect(fabricGateway.submit.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.lote.update.mock.invocationCallOrder[0],
    );
  });

  it('si el chaincode rechaza, no escribe el PDF ni Postgres', async () => {
    fabricGateway.submit.mockRejectedValue(new Error('rechazado'));
    const fs = jest.requireMock('node:fs') as { writeFileSync: jest.Mock };

    await expect(service.create(dto, archivo, user)).rejects.toThrow();

    expect(fs.writeFileSync).not.toHaveBeenCalled();
    expect(prisma.lote.update).not.toHaveBeenCalled();
    expect(prisma.certificado.create).not.toHaveBeenCalled();
  });
});
