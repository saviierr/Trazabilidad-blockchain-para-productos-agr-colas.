import { Injectable } from '@nestjs/common';
import { EstadoLote, RolNombre } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizacionContextService } from '../common/organizacion-context.service';
import { LotesService } from '../lotes/lotes.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

const ESTADOS_ORDEN: EstadoLote[] = [
  EstadoLote.CREADO,
  EstadoLote.FERMENTANDO,
  EstadoLote.CERTIFICADO,
  EstadoLote.EN_TRANSPORTE,
  EstadoLote.EXPORTADO,
];

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizacionContext: OrganizacionContextService,
    private readonly lotesService: LotesService,
  ) {}

  // Todos los indicadores derivados de lotes reutilizan el mismo alcance
  // "solo propio" que ya calcula GET /lotes (ver docs/WP-16-plan-dashboard-administrativo.md §2).
  async resumen(user: AuthenticatedUser) {
    const loteWhere = await this.lotesService.buildScopeFilter(user);

    const [
      totalLotes,
      lotesPorEstadoRaw,
      totalCertificados,
      totalExportaciones,
      exportacionesPorPaisRaw,
      totalProductores,
      totalCooperativas,
    ] = await Promise.all([
      this.prisma.lote.count({ where: loteWhere }),
      this.prisma.lote.groupBy({
        by: ['estado'],
        where: loteWhere,
        _count: { _all: true },
      }),
      this.prisma.certificado.count({ where: { lote: loteWhere } }),
      this.prisma.exportacion.count({ where: { lote: loteWhere } }),
      this.prisma.exportacion.groupBy({
        by: ['paisDestino'],
        where: { lote: loteWhere },
        _count: { _all: true },
      }),
      this.totalProductores(user),
      this.prisma.cooperativa.count(),
    ]);

    const cantidadPorEstado = new Map(
      lotesPorEstadoRaw.map((fila) => [fila.estado, fila._count._all]),
    );

    const exportacionesPorPais = exportacionesPorPaisRaw
      .map((fila) => ({
        paisDestino: fila.paisDestino,
        cantidad: fila._count._all,
      }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5);

    return {
      totalLotes,
      totalProductores,
      totalCooperativas,
      totalCertificados,
      totalExportaciones,
      // Incluye los 5 estados de C1 aunque alguno esté en 0 — es lo que
      // permite mostrar "lotes pendientes por etapa" completo en el gráfico.
      lotesPorEstado: ESTADOS_ORDEN.map((estado) => ({
        estado,
        cantidad: cantidadPorEstado.get(estado) ?? 0,
      })),
      exportacionesPorPais,
    };
  }

  // Mismo criterio que GET /productores (WP-10): Cooperativa ve los suyos,
  // Productor ve 1, el resto ve el total global de productores activos.
  private async totalProductores(user: AuthenticatedUser): Promise<number> {
    if (user.rol === RolNombre.COOPERATIVA) {
      const cooperativaId =
        await this.organizacionContext.resolveCooperativaId(user);
      return this.prisma.productor.count({
        where: { cooperativaId, activo: true },
      });
    }
    if (user.rol === RolNombre.PRODUCTOR) {
      return this.prisma.productor.count({
        where: { usuarioId: user.id, activo: true },
      });
    }
    return this.prisma.productor.count({ where: { activo: true } });
  }
}
