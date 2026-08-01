import { Injectable } from '@nestjs/common';
import { Prisma, RolNombre } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CooperativaContextService } from '../common/cooperativa-context.service';
import { INCLUDE_LOTE } from '../cooperativas/cooperativas.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

@Injectable()
export class LotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cooperativaContext: CooperativaContextService,
  ) {}

  // "Solo propio" real para Cooperativa/Productor (C7). Certificadora/
  // Transportista/Exportador/Comprador/Admin ven todos los lotes por ahora —
  // su relación específica con un lote no existe como dato hasta WP-12/13/14
  // (ver docs/WP-11-plan-modulo-cooperativas.md §8).
  async findAll(user: AuthenticatedUser) {
    const where: Prisma.LoteWhereInput = {};

    if (user.rol === RolNombre.COOPERATIVA) {
      where.cooperativaId =
        await this.cooperativaContext.resolveCooperativaId(user);
    } else if (user.rol === RolNombre.PRODUCTOR) {
      where.productor = { usuarioId: user.id };
    }

    return this.prisma.lote.findMany({
      where,
      include: INCLUDE_LOTE,
      orderBy: { createdAt: 'desc' },
    });
  }
}
