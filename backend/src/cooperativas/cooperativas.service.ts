import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoLote, Prisma, TipoEvento } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CooperativaContextService } from '../common/cooperativa-context.service';
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
    private readonly cooperativaContext: CooperativaContextService,
  ) {}

  // C7: "Crear lote" — solo Cooperativa, y solo sobre sus propios productores.
  // Endpoint real per C5 (POST /cooperativas/recepcion); corrige el placeholder
  // POST /lotes que había dejado WP-04 (ver docs/WP-11-plan-modulo-cooperativas.md §2.1).
  async recepcion(dto: RecepcionLoteDto, user: AuthenticatedUser) {
    const cooperativaId =
      await this.cooperativaContext.resolveCooperativaId(user);

    const productor = await this.prisma.productor.findUnique({
      where: { id: dto.productorId },
    });
    if (!productor || productor.cooperativaId !== cooperativaId) {
      throw new NotFoundException('Productor no encontrado');
    }
    if (!productor.activo) {
      throw new BadRequestException('El productor está inactivo');
    }

    const lote = await this.prisma.lote.create({
      data: {
        productorId: productor.id,
        cooperativaId,
        fechaCosecha: new Date(dto.fechaCosecha),
        pesoInicialKg: dto.pesoInicialKg,
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
      },
    });

    return lote;
  }

  // C7: "Registrar fermentación/secado" — solo Cooperativa, solo sobre lotes propios.
  // Aplica la regla de negocio de Fase I (peso ≤ capacidad máxima del productor) y
  // la transición de estado C1 (Creado → Fermentando).
  async registrarFermentacion(dto: FermentacionLoteDto, user: AuthenticatedUser) {
    const cooperativaId =
      await this.cooperativaContext.resolveCooperativaId(user);

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

    const actualizado = await this.prisma.lote.update({
      where: { id: lote.id },
      data: {
        estado: EstadoLote.FERMENTANDO,
        pesoFermentadoKg: dto.peso,
        fechaSecado: new Date(dto.fechaSecado),
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
      },
    });

    return actualizado;
  }
}
