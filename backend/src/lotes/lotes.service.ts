import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { Prisma, RolNombre, TipoEvento } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizacionContextService } from '../common/organizacion-context.service';
import { FabricGatewayService } from '../fabric-gateway/fabric-gateway.service';
import { OrgChaincode } from '../fabric-gateway/types';
import { INCLUDE_LOTE } from '../cooperativas/cooperativas.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { CorregirLoteDto } from './dto/corregir-lote.dto';

// Forma mínima del lote on-chain (C2) que interesa comparar contra la
// proyección de Postgres — WP-22 §2.6. El resto de campos viaja tal cual.
export interface LoteOnChain {
  loteId: string;
  estado: string;
  hashCertificado?: string;
  historialEventos: unknown[];
  [key: string]: unknown;
}

// Compara estado/hashCertificado on-chain vs. Postgres — WP-22 §2.6.
// Compartido con PublicLotesService (WP-23) para no duplicar el criterio de
// "sincronizado" entre la vista autenticada y la pública.
export function compararConOnChain(
  lote: { estado: string; hashCertificado: string | null },
  onChain: LoteOnChain,
): { sincronizado: boolean; diferencias: string[] } {
  const diferencias: string[] = [];
  if (onChain.estado !== lote.estado) {
    diferencias.push(
      `estado: on-chain=${onChain.estado}, Postgres=${lote.estado}`,
    );
  }
  const hashOnChain = onChain.hashCertificado ?? null;
  const hashPostgres = lote.hashCertificado ?? null;
  if (hashOnChain !== hashPostgres) {
    diferencias.push(
      `hashCertificado: on-chain=${hashOnChain}, Postgres=${hashPostgres}`,
    );
  }
  return { sincronizado: diferencias.length === 0, diferencias };
}

export const INCLUDE_LOTE_DETALLE = {
  productor: true,
  cooperativa: { include: { organizacion: true } },
  certificados: {
    include: { certificadora: { include: { organizacion: true } } },
    orderBy: { createdAt: 'desc' },
  },
  transporte: {
    include: {
      transportista: { include: { organizacion: true } },
      incidencias: { orderBy: { fecha: 'desc' } },
    },
  },
  exportacion: {
    include: { exportador: { include: { organizacion: true } } },
  },
} satisfies Prisma.LoteInclude;

@Injectable()
export class LotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizacionContext: OrganizacionContextService,
    private readonly fabricGateway: FabricGatewayService,
    private readonly config: ConfigService,
  ) {}

  async findAll(user: AuthenticatedUser) {
    const where = await this.buildScopeFilter(user);
    return this.prisma.lote.findMany({
      where,
      include: INCLUDE_LOTE,
      orderBy: { createdAt: 'desc' },
    });
  }

  // Vista de detalle completa (C5 no la define aparte del historial, pero el
  // DoD exige poder consultar un lote con todas sus relaciones — ver
  // docs/WP-15-plan-modulo-lotes.md §2.2). Mismo alcance "solo propio" que findAll.
  async findOne(id: string, user: AuthenticatedUser) {
    const where = await this.buildScopeFilter(user);
    const lote = await this.prisma.lote.findFirst({
      where: { ...where, id },
      include: INCLUDE_LOTE_DETALLE,
    });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }
    return lote;
  }

  // Proyección de lectura del historialEventos on-chain (C2) — orden cronológico.
  async historial(id: string, user: AuthenticatedUser) {
    await this.findOne(id, user); // aplica el mismo alcance y devuelve 404 si no corresponde

    return this.prisma.evento.findMany({
      where: { loteId: id },
      include: { actorUsuario: true, actorOrganizacion: true },
      orderBy: { timestamp: 'asc' },
    });
  }

  // WP-22 §2.6: lectura en vivo del ledger (QueryLote, solo lectura — no
  // pasa por el orderer) comparada contra la proyección de Postgres. Detecta
  // divergencias y las reporta; no las repara automáticamente (§6 del plan).
  async blockchain(id: string, user: AuthenticatedUser) {
    const lote = await this.findOne(id, user);

    const raw = await this.fabricGateway.evaluate(
      OrgChaincode.COOPERATIVA,
      'QueryLote',
      id,
    );
    const onChain = JSON.parse(raw) as LoteOnChain;
    const { sincronizado, diferencias } = compararConOnChain(lote, onChain);

    return { onChain, sincronizado, diferencias };
  }

  // WP-23 §2.1/§2.2: QR generado al vuelo (no se persiste ningún archivo).
  // Mismo alcance "solo propio" que el resto de endpoints de lote — la
  // consulta pública en sí (GET /public/lotes/:id) no pasa por aquí.
  async generarQr(id: string, user: AuthenticatedUser): Promise<Buffer> {
    await this.findOne(id, user); // aplica el alcance y devuelve 404 si no corresponde

    const eventoCreacion = await this.prisma.evento.findFirst({
      where: { loteId: id, tipo: TipoEvento.CREACION },
    });

    // C6 (Plan Maestro §2, forma congelada). hashVerificacion = hash de la
    // transacción CreateLot, no la más reciente — ver WP-23 §2.2.
    const payload = {
      loteId: id,
      url: `${this.config.get<string>('FRONTEND_URL', 'http://localhost:5173')}/public/lotes/${id}`,
      hashVerificacion: eventoCreacion?.hashTransaccionBlockchain ?? null,
    };

    return QRCode.toBuffer(JSON.stringify(payload), {
      type: 'png',
      errorCorrectionLevel: 'M',
      width: 300,
    });
  }

  // Corrección auditada (WP-15 §2.3): solo fechaCosecha/pesoInicialKg, nunca
  // el estado. Usa TipoEvento.CORRECCION por primera vez desde WP-01.
  async update(id: string, dto: CorregirLoteDto, user: AuthenticatedUser) {
    if (dto.fechaCosecha === undefined && dto.pesoInicialKg === undefined) {
      throw new BadRequestException(
        'Debe indicar al menos un campo a corregir (fechaCosecha o pesoInicialKg)',
      );
    }

    const lote = await this.prisma.lote.findUnique({ where: { id } });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }

    if (user.rol === RolNombre.COOPERATIVA) {
      const cooperativaId =
        await this.organizacionContext.resolveCooperativaId(user);
      if (lote.cooperativaId !== cooperativaId) {
        throw new NotFoundException('Lote no encontrado');
      }
    }
    // ADMIN: sin restricción de propiedad — el rol ya lo valida @Roles().

    const valoresAnteriores = {
      fechaCosecha: lote.fechaCosecha.toISOString(),
      pesoInicialKg:
        lote.pesoInicialKg !== null ? Number(lote.pesoInicialKg) : null,
    };
    const valoresNuevos = {
      fechaCosecha:
        dto.fechaCosecha !== undefined
          ? new Date(dto.fechaCosecha).toISOString()
          : valoresAnteriores.fechaCosecha,
      pesoInicialKg:
        dto.pesoInicialKg !== undefined
          ? dto.pesoInicialKg
          : valoresAnteriores.pesoInicialKg,
    };

    const actualizado = await this.prisma.lote.update({
      where: { id },
      data: {
        ...(dto.fechaCosecha !== undefined && {
          fechaCosecha: new Date(dto.fechaCosecha),
        }),
        ...(dto.pesoInicialKg !== undefined && {
          pesoInicialKg: dto.pesoInicialKg,
        }),
      },
      include: INCLUDE_LOTE,
    });

    await this.prisma.evento.create({
      data: {
        loteId: id,
        tipo: TipoEvento.CORRECCION,
        actorUsuarioId: user.id,
        actorOrganizacionId: user.organizacionId,
        datosEspecificos: { anterior: valoresAnteriores, nuevo: valoresNuevos },
      },
    });

    return actualizado;
  }

  // "Solo propio" (C7 + WP-15 §2.4): Cooperativa/Productor ya lo tenían;
  // Certificadora/Transportista/Exportador se cierran ahora que sus relaciones
  // con el lote existen como dato (WP-12/13/14). Comprador y Admin ven todos.
  // Público (no privado): DashboardService (WP-16) lo reutiliza para que los
  // indicadores respeten el mismo alcance que GET /lotes.
  async buildScopeFilter(
    user: AuthenticatedUser,
  ): Promise<Prisma.LoteWhereInput> {
    if (user.rol === RolNombre.COOPERATIVA) {
      return {
        cooperativaId:
          await this.organizacionContext.resolveCooperativaId(user),
      };
    }
    if (user.rol === RolNombre.PRODUCTOR) {
      return { productor: { usuarioId: user.id } };
    }
    if (user.rol === RolNombre.CERTIFICADORA) {
      return {
        certificados: {
          some: {
            certificadoraId:
              await this.organizacionContext.resolveCertificadoraId(user),
          },
        },
      };
    }
    if (user.rol === RolNombre.TRANSPORTISTA) {
      return {
        transporte: {
          transportistaId:
            await this.organizacionContext.resolveTransportistaId(user),
        },
      };
    }
    if (user.rol === RolNombre.EXPORTADOR) {
      return {
        exportacion: {
          exportadorId:
            await this.organizacionContext.resolveExportadorId(user),
        },
      };
    }
    return {}; // ADMIN y COMPRADOR: sin filtro (C7 — Comprador es público de lectura)
  }
}
