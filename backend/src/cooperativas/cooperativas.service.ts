import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EstadoLote, Prisma, TipoEvento } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizacionContextService } from '../common/organizacion-context.service';
import { FabricGatewayService } from '../fabric-gateway/fabric-gateway.service';
import { OrgChaincode } from '../fabric-gateway/types';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { RecepcionLoteDto } from './dto/recepcion-lote.dto';
import type { FermentacionLoteDto } from './dto/fermentacion-lote.dto';

export const INCLUDE_LOTE = {
  productor: true,
  cooperativa: { include: { organizacion: true } },
} satisfies Prisma.LoteInclude;

@Injectable()
export class CooperativasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizacionContext: OrganizacionContextService,
    private readonly fabricGateway: FabricGatewayService,
  ) {}

  // C7: "Crear lote" — solo Cooperativa, y solo sobre sus propios productores.
  // Endpoint real per C5 (POST /cooperativas/recepcion); corrige el placeholder
  // POST /lotes que había dejado WP-04 (ver docs/WP-11-plan-modulo-cooperativas.md §2.1).
  // WP-22 §2.4: el chaincode se invoca antes de escribir en Postgres — si lo
  // rechaza, no queda ninguna fila off-chain sin respaldo on-chain.
  async recepcion(dto: RecepcionLoteDto, user: AuthenticatedUser) {
    const cooperativaId =
      await this.organizacionContext.resolveCooperativaId(user);

    const productor = await this.prisma.productor.findUnique({
      where: { id: dto.productorId },
    });
    if (!productor || productor.cooperativaId !== cooperativaId) {
      throw new NotFoundException('Productor no encontrado');
    }
    if (!productor.activo) {
      throw new BadRequestException('El productor está inactivo');
    }

    // loteId generado aquí (no por Prisma) porque debe coincidir con el
    // loteId on-chain (esquema: `Lote.id === loteId on-chain`) — mismo
    // patrón que ya usa CertificadosService para el id del certificado.
    const loteId = randomUUID();
    const { transactionId } = await this.fabricGateway.submit(
      OrgChaincode.COOPERATIVA,
      'CreateLot',
      loteId,
      productor.id,
      cooperativaId,
      dto.fechaCosecha,
      // Snapshot on-chain de la capacidad máxima (WP-21 §2.5): el chaincode
      // no tiene acceso a Postgres para validar RegisterFermentation.
      productor.capacidadProductivaMaximaKg.toString(),
    );

    const lote = await this.prisma.lote.create({
      data: {
        id: loteId,
        productorId: productor.id,
        cooperativaId,
        fechaCosecha: new Date(dto.fechaCosecha),
        pesoInicialKg: dto.pesoInicialKg,
        ultimaTxHashBlockchain: transactionId,
      },
      include: INCLUDE_LOTE,
    });

    await this.prisma.evento.create({
      data: {
        loteId: lote.id,
        tipo: TipoEvento.CREACION,
        actorUsuarioId: user.id,
        actorOrganizacionId: user.organizacionId,
        datosEspecificos: {
          pesoInicialKg: dto.pesoInicialKg,
          fechaCosecha: dto.fechaCosecha,
        },
        hashTransaccionBlockchain: transactionId,
      },
    });

    return lote;
  }

  // C7: "Registrar fermentación/secado" — solo Cooperativa, solo sobre lotes propios.
  // Aplica la regla de negocio de Fase I (peso ≤ capacidad máxima del productor) y
  // la transición de estado C1 (Creado → Fermentando).
  async registrarFermentacion(dto: FermentacionLoteDto, user: AuthenticatedUser) {
    const cooperativaId =
      await this.organizacionContext.resolveCooperativaId(user);

    const lote = await this.prisma.lote.findUnique({
      where: { id: dto.loteId },
      include: { productor: true },
    });
    if (!lote || lote.cooperativaId !== cooperativaId) {
      throw new NotFoundException('Lote no encontrado');
    }
    if (lote.estado !== EstadoLote.CREADO) {
      throw new ConflictException(
        `El lote está en estado ${lote.estado}; solo se puede registrar fermentación desde Creado`,
      );
    }
    if (dto.peso > Number(lote.productor.capacidadProductivaMaximaKg)) {
      throw new BadRequestException(
        'El peso reportado excede la capacidad productiva máxima registrada para esa finca',
      );
    }

    const { transactionId } = await this.fabricGateway.submit(
      OrgChaincode.COOPERATIVA,
      'RegisterFermentation',
      lote.id,
      String(dto.peso),
      dto.fechaSecado,
    );

    const actualizado = await this.prisma.lote.update({
      where: { id: lote.id },
      data: {
        estado: EstadoLote.FERMENTANDO,
        pesoFermentadoKg: dto.peso,
        fechaSecado: new Date(dto.fechaSecado),
        ultimaTxHashBlockchain: transactionId,
      },
      include: INCLUDE_LOTE,
    });

    await this.prisma.evento.create({
      data: {
        loteId: lote.id,
        tipo: TipoEvento.FERMENTACION,
        actorUsuarioId: user.id,
        actorOrganizacionId: user.organizacionId,
        datosEspecificos: { peso: dto.peso, fechaSecado: dto.fechaSecado },
        hashTransaccionBlockchain: transactionId,
      },
    });

    return actualizado;
  }
}
