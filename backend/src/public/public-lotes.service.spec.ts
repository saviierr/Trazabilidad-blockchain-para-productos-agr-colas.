import { NotFoundException } from '@nestjs/common';
import { EstadoLote, TipoEvento } from '@prisma/client';

// Ver cooperativas.service.spec.ts: evita que PublicLotesService arrastre
// el módulo real de fabric-gateway.service (y con él @hyperledger/fabric-gateway).
jest.mock('../fabric-gateway/fabric-gateway.service', () => ({
  FabricGatewayService: jest.fn(),
}));

import { PublicLotesService } from './public-lotes.service';
import { FabricGatewayService } from '../fabric-gateway/fabric-gateway.service';
import { OrgChaincode } from '../fabric-gateway/types';
import { PrismaService } from '../prisma/prisma.service';

describe('PublicLotesService', () => {
  let service: PublicLotesService;
  let prisma: { lote: { findUnique: jest.Mock }; evento: { findMany: jest.Mock } };
  let fabricGateway: { evaluate: jest.Mock };

  const loteBase = {
    id: 'lote-1',
    estado: EstadoLote.EXPORTADO,
    fechaCosecha: new Date('2026-08-01'),
    fechaSecado: new Date('2026-08-05'),
    fechaTransporte: new Date('2026-08-10'),
    fechaExportacion: new Date('2026-08-20'),
    hashCertificado: 'hash-cert',
    cooperativa: { organizacion: { nombre: 'Cooperativa Demo' } },
    certificados: [{ certificadora: { organizacion: { nombre: 'Certificadora Demo' } } }],
    transporte: { transportista: { organizacion: { nombre: 'Transportista Demo' } } },
    exportacion: {
      paisDestino: 'Bélgica',
      exportador: { organizacion: { nombre: 'Exportador Demo' } },
    },
  };

  const eventos = [
    {
      tipo: TipoEvento.CREACION,
      actorOrganizacion: { nombre: 'Cooperativa Demo' },
      timestamp: new Date('2026-08-01'),
      datosEspecificos: { fechaCosecha: '2026-08-01' },
      hashTransaccionBlockchain: 'tx-creacion',
    },
    {
      tipo: TipoEvento.EXPORTACION,
      actorOrganizacion: { nombre: 'Exportador Demo' },
      timestamp: new Date('2026-08-20'),
      datosEspecificos: { paisDestino: 'Bélgica' },
      hashTransaccionBlockchain: 'tx-exportacion',
    },
  ];

  beforeEach(() => {
    prisma = {
      lote: { findUnique: jest.fn() },
      evento: { findMany: jest.fn() },
    };
    fabricGateway = { evaluate: jest.fn() };

    service = new PublicLotesService(
      prisma as unknown as PrismaService,
      fabricGateway as unknown as FabricGatewayService,
    );
  });

  it('lanza NotFoundException si el lote no existe', async () => {
    prisma.lote.findUnique.mockResolvedValue(null);
    await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
  });

  it('arma la proyección pública sin datos personales', async () => {
    prisma.lote.findUnique.mockResolvedValue(loteBase);
    prisma.evento.findMany.mockResolvedValue(eventos);
    fabricGateway.evaluate.mockResolvedValue(
      JSON.stringify({ estado: 'EXPORTADO', hashCertificado: 'hash-cert' }),
    );

    const resultado = await service.findOne('lote-1');

    expect(resultado.loteId).toBe('lote-1');
    expect(resultado.cooperativa).toBe('Cooperativa Demo');
    expect(resultado.certificadora).toBe('Certificadora Demo');
    expect(resultado.transportista).toBe('Transportista Demo');
    expect(resultado.exportador).toBe('Exportador Demo');
    expect(resultado.paisDestino).toBe('Bélgica');
    expect(resultado.hashVerificacion).toBe('tx-creacion');
    expect(resultado.sincronizado).toBe(true);
    expect(resultado.historial).toHaveLength(2);

    // No debe haber rastro de actorUsuario/cedula/etc en la salida serializada.
    const serializado = JSON.stringify(resultado);
    expect(serializado).not.toMatch(/actorUsuario|cedula/i);

    // El servicio nunca consultó actorUsuario — ni siquiera lo pidió a Prisma.
    expect(prisma.evento.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { actorOrganizacion: true },
      }),
    );
  });

  it('usa la identidad de Cooperativa para leer el ledger (lectura pública, C7)', async () => {
    prisma.lote.findUnique.mockResolvedValue(loteBase);
    prisma.evento.findMany.mockResolvedValue(eventos);
    fabricGateway.evaluate.mockResolvedValue(
      JSON.stringify({ estado: 'EXPORTADO', hashCertificado: 'hash-cert' }),
    );

    await service.findOne('lote-1');

    expect(fabricGateway.evaluate).toHaveBeenCalledWith(
      OrgChaincode.COOPERATIVA,
      'QueryLote',
      'lote-1',
    );
  });

  it('sincronizado queda en null (no false) si la blockchain no responde', async () => {
    prisma.lote.findUnique.mockResolvedValue(loteBase);
    prisma.evento.findMany.mockResolvedValue(eventos);
    fabricGateway.evaluate.mockRejectedValue(new Error('UNAVAILABLE'));

    const resultado = await service.findOne('lote-1');

    expect(resultado.sincronizado).toBeNull();
    // La página pública sigue respondiendo con lo que sí tiene Postgres.
    expect(resultado.estado).toBe('EXPORTADO');
  });

  it('sincronizado es false si el on-chain diverge de Postgres', async () => {
    prisma.lote.findUnique.mockResolvedValue(loteBase);
    prisma.evento.findMany.mockResolvedValue(eventos);
    fabricGateway.evaluate.mockResolvedValue(
      JSON.stringify({ estado: 'EN_TRANSPORTE', hashCertificado: 'hash-cert' }),
    );

    const resultado = await service.findOne('lote-1');

    expect(resultado.sincronizado).toBe(false);
  });
});
