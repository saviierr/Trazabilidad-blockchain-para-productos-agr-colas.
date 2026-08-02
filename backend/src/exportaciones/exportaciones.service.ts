import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoLote, Prisma, RolNombre, TipoEvento } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizacionContextService } from '../common/organizacion-context.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { CreateExportacionDto } from './dto/create-exportacion.dto';

const INCLUDE_EXPORTACION = {
  lote: { include: { productor: true, cooperativa: { include: { organizacion: true } } } },
  exportador: { include: { organizacion: true } },
} satisfies Prisma.ExportacionInclude;

@Injectable()
export class ExportacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizacionContext: OrganizacionContextService,
  ) {}

  // C7: "Registrar exportación" — solo Exportador, sin restricción sobre qué
  // lote (no hay relación de pertenencia previa, igual que Certificadora/Transportista).
  async create(dto: CreateExportacionDto, user: AuthenticatedUser) {
    const lote = await this.prisma.lote.findUnique({ where: { id: dto.loteId } });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }
    if (lote.estado !== EstadoLote.EN_TRANSPORTE) {
      throw new ConflictException(
        `El lote está en estado ${lote.estado}; solo se puede exportar desde En Transporte`,
      );
    }

    const exportadorId =
      await this.organizacionContext.resolveExportadorId(user);

    const fechaExportacion = new Date(dto.fechaExportacion);

    // Transición final de C1: no hay estado posterior a Exportado.
    await this.prisma.lote.update({
      where: { id: lote.id },
      data: { estado: EstadoLote.EXPORTADO, fechaExportacion },
    });

    const exportacion = await this.prisma.exportacion.create({
      data: {
        loteId: lote.id,
        exportadorId,
        empresaCompradora: dto.empresaCompradora,
        paisDestino: dto.paisDestino,
        puertoSalida: dto.puertoSalida,
        fechaExportacion,
        numeroDocumentoAduanero: dto.numeroDocumentoAduanero,
      },
      include: INCLUDE_EXPORTACION,
    });

    await this.prisma.evento.create({
      data: {
        loteId: lote.id,
        tipo: TipoEvento.EXPORTACION,
        actorUsuarioId: user.id,
        actorOrganizacionId: user.organizacionId,
        datosEspecificos: {
          empresaCompradora: dto.empresaCompradora,
          paisDestino: dto.paisDestino,
          puertoSalida: dto.puertoSalida,
        },
      },
    });

    return exportacion;
  }

  async findAll(user: AuthenticatedUser) {
    const where: Prisma.ExportacionWhereInput = await this.buildScopeFilter(user);
    return this.prisma.exportacion.findMany({
      where,
      include: INCLUDE_EXPORTACION,
      orderBy: { createdAt: 'desc' },
    });
  }

  private async buildScopeFilter(
    user: AuthenticatedUser,
  ): Promise<Prisma.ExportacionWhereInput> {
    if (user.rol === RolNombre.EXPORTADOR) {
      return {
        exportadorId: await this.organizacionContext.resolveExportadorId(user),
      };
    }
    if (user.rol === RolNombre.COOPERATIVA) {
      return {
        lote: {
          cooperativaId: await this.organizacionContext.resolveCooperativaId(user),
        },
      };
    }
    if (user.rol === RolNombre.PRODUCTOR) {
      return { lote: { productor: { usuarioId: user.id } } };
    }
    return {}; // ADMIN y el resto: sin filtro (ver §4 del plan)
  }
}
