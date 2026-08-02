import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TipoEvento } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FabricGatewayService } from '../fabric-gateway/fabric-gateway.service';
import { OrgChaincode } from '../fabric-gateway/types';
import { compararConOnChain, type LoteOnChain } from '../lotes/lotes.service';

const INCLUDE_LOTE_PUBLICO = {
  cooperativa: { include: { organizacion: true } },
  certificados: {
    include: { certificadora: { include: { organizacion: true } } },
    orderBy: { createdAt: 'desc' },
  },
  transporte: { include: { transportista: { include: { organizacion: true } } } },
  exportacion: { include: { exportador: { include: { organizacion: true } } } },
} satisfies Prisma.LoteInclude;

// WP-23 §2.3/§2.4: proyección pública de un lote — combina Postgres (rápido,
// nombres de institución) con una lectura en vivo del ledger (sincronizado).
// A diferencia de LotesService, no recibe AuthenticatedUser: no hay alcance
// "solo propio" que aplicar, es la consulta de C5 sin autenticación.
@Injectable()
export class PublicLotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fabricGateway: FabricGatewayService,
  ) {}

  async findOne(id: string) {
    const lote = await this.prisma.lote.findUnique({
      where: { id },
      include: INCLUDE_LOTE_PUBLICO,
    });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    // Ni se consulta actorUsuario (nombre de la persona que operó, dato que
    // Fase II §6/C3 nunca publica) — solo la organización, que ya es
    // información institucional visible hoy a usuarios autenticados.
    const eventos = await this.prisma.evento.findMany({
      where: { loteId: id },
      include: { actorOrganizacion: true },
      orderBy: { timestamp: 'asc' },
    });
    const eventoCreacion = eventos.find((e) => e.tipo === TipoEvento.CREACION);

    // sincronizado queda en null (no en false) si la red blockchain no
    // responde: es "no se pudo verificar ahora", no "hay una divergencia
    // real" — una página pública no debe caer con 503 solo porque el nodo
    // de lectura está momentáneamente inalcanzable (§6 del plan).
    let sincronizado: boolean | null = null;
    try {
      const raw = await this.fabricGateway.evaluate(
        OrgChaincode.COOPERATIVA,
        'QueryLote',
        id,
      );
      const onChain = JSON.parse(raw) as LoteOnChain;
      sincronizado = compararConOnChain(lote, onChain).sincronizado;
    } catch {
      sincronizado = null;
    }

    return {
      loteId: lote.id,
      estado: lote.estado,
      fechaCosecha: lote.fechaCosecha,
      fechaSecado: lote.fechaSecado,
      fechaTransporte: lote.fechaTransporte,
      fechaExportacion: lote.fechaExportacion,
      cooperativa: lote.cooperativa.organizacion.nombre,
      certificadora:
        lote.certificados[0]?.certificadora.organizacion.nombre ?? null,
      transportista: lote.transporte?.transportista.organizacion.nombre ?? null,
      exportador: lote.exportacion?.exportador.organizacion.nombre ?? null,
      paisDestino: lote.exportacion?.paisDestino ?? null,
      hashCertificado: lote.hashCertificado,
      hashVerificacion: eventoCreacion?.hashTransaccionBlockchain ?? null,
      historial: eventos.map((evento) => ({
        tipo: evento.tipo,
        organizacion: evento.actorOrganizacion?.nombre ?? null,
        timestamp: evento.timestamp,
        datos: evento.datosEspecificos,
        hashTransaccionBlockchain: evento.hashTransaccionBlockchain,
      })),
      sincronizado,
    };
  }
}
