import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstadoLote,
  EstadoTransporte,
  Prisma,
  RolNombre,
  TipoEvento,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizacionContextService } from '../common/organizacion-context.service';
import { FabricGatewayService } from '../fabric-gateway/fabric-gateway.service';
import { OrgChaincode } from '../fabric-gateway/types';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { CreateTransporteDto } from './dto/create-transporte.dto';
import type { ActualizarEstadoTransporteDto } from './dto/actualizar-estado-transporte.dto';
import type { CreateIncidenciaDto } from './dto/create-incidencia.dto';

const INCLUDE_TRANSPORTE = {
  lote: { include: { productor: true, cooperativa: { include: { organizacion: true } } } },
  transportista: { include: { organizacion: true } },
  incidencias: { orderBy: { fecha: 'desc' } },
} satisfies Prisma.TransporteInclude;

@Injectable()
export class TransportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizacionContext: OrganizacionContextService,
    private readonly fabricGateway: FabricGatewayService,
  ) {}

  // C7: "Registrar transporte" — solo Transportista, sin restricción sobre qué
  // lote (no hay relación de pertenencia previa, igual que Certificadora en WP-12).
  // WP-22 §2.3: TransportistaMSP no tiene peer propio — FabricGatewayService
  // lo enruta a través del peer de Cooperativa, firmando como TransportistaMSP.
  async create(dto: CreateTransporteDto, user: AuthenticatedUser) {
    const lote = await this.prisma.lote.findUnique({ where: { id: dto.loteId } });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }
    if (lote.estado !== EstadoLote.CERTIFICADO) {
      throw new ConflictException(
        `El lote está en estado ${lote.estado}; solo se puede transportar desde Certificado`,
      );
    }

    const transportistaId =
      await this.organizacionContext.resolveTransportistaId(user);

    const fechaSalida = new Date(dto.fechaSalida);
    // C4 no define un esquema propio para `tiempos` — se compone un texto
    // legible a partir de los campos que ya expone el DTO (WP-22, decisión
    // registrada porque C4 deja el formato abierto).
    const tiempos = dto.fechaLlegadaEstimada
      ? `Salida: ${dto.fechaSalida} · Llegada estimada: ${dto.fechaLlegadaEstimada}`
      : `Salida: ${dto.fechaSalida}`;

    const { transactionId } = await this.fabricGateway.submit(
      OrgChaincode.TRANSPORTISTA,
      'RegisterTransport',
      lote.id,
      transportistaId,
      dto.ruta,
      tiempos,
    );

    await this.prisma.lote.update({
      where: { id: lote.id },
      data: {
        estado: EstadoLote.EN_TRANSPORTE,
        fechaTransporte: fechaSalida,
        ultimaTxHashBlockchain: transactionId,
      },
    });

    const transporte = await this.prisma.transporte.create({
      data: {
        loteId: lote.id,
        transportistaId,
        ruta: dto.ruta,
        fechaSalida,
        fechaLlegadaEstimada: dto.fechaLlegadaEstimada
          ? new Date(dto.fechaLlegadaEstimada)
          : undefined,
      },
      include: INCLUDE_TRANSPORTE,
    });

    await this.prisma.evento.create({
      data: {
        loteId: lote.id,
        tipo: TipoEvento.TRANSPORTE,
        actorUsuarioId: user.id,
        actorOrganizacionId: user.organizacionId,
        datosEspecificos: { ruta: dto.ruta, fechaSalida: dto.fechaSalida },
        hashTransaccionBlockchain: transactionId,
      },
    });

    return transporte;
  }

  async findAll(user: AuthenticatedUser) {
    const where: Prisma.TransporteWhereInput = await this.buildScopeFilter(user);
    return this.prisma.transporte.findMany({
      where,
      include: INCLUDE_TRANSPORTE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async actualizarEstado(
    id: string,
    dto: ActualizarEstadoTransporteDto,
    user: AuthenticatedUser,
  ) {
    const transporte = await this.findPropio(id, user);

    if (transporte.estado === EstadoTransporte.ENTREGADO) {
      throw new ConflictException('El transporte ya está marcado como entregado');
    }
    if (dto.estado !== EstadoTransporte.ENTREGADO) {
      throw new ConflictException(
        'La única transición válida desde En ruta es a Entregado',
      );
    }

    return this.prisma.transporte.update({
      where: { id },
      data: { estado: EstadoTransporte.ENTREGADO, fechaLlegadaReal: new Date() },
      include: INCLUDE_TRANSPORTE,
    });
  }

  // Una incidencia no cambia el estado del transporte (ver §3 del plan WP-13).
  async registrarIncidencia(
    id: string,
    dto: CreateIncidenciaDto,
    user: AuthenticatedUser,
  ) {
    await this.findPropio(id, user);
    await this.prisma.incidencia.create({
      data: { transporteId: id, descripcion: dto.descripcion },
    });
    return this.prisma.transporte.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_TRANSPORTE,
    });
  }

  // "Solo propio": el transportista solo puede actuar sobre transportes que él
  // mismo creó — 404 en vez de 403 para no filtrar existencia (mismo patrón WP-10/11/12).
  private async findPropio(id: string, user: AuthenticatedUser) {
    const transporte = await this.prisma.transporte.findUnique({ where: { id } });
    if (!transporte) {
      throw new NotFoundException('Transporte no encontrado');
    }
    if (user.rol === RolNombre.TRANSPORTISTA) {
      const transportistaId =
        await this.organizacionContext.resolveTransportistaId(user);
      if (transporte.transportistaId !== transportistaId) {
        throw new NotFoundException('Transporte no encontrado');
      }
    }
    return transporte;
  }

  private async buildScopeFilter(
    user: AuthenticatedUser,
  ): Promise<Prisma.TransporteWhereInput> {
    if (user.rol === RolNombre.TRANSPORTISTA) {
      return {
        transportistaId:
          await this.organizacionContext.resolveTransportistaId(user),
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
