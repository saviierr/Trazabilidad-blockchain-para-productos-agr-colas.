import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

// Resuelve el usuario COOPERATIVA autenticado (Usuario.organizacionId) a su
// fila Cooperativa.id. Compartido entre ProductoresService y CooperativasService
// para no duplicar el mismo lookup (ver docs/WP-11-plan-modulo-cooperativas.md §4).
@Injectable()
export class CooperativaContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveCooperativaId(user: AuthenticatedUser): Promise<string> {
    if (!user.organizacionId) {
      throw new ForbiddenException('El usuario no tiene una organización asociada');
    }
    const cooperativa = await this.prisma.cooperativa.findUnique({
      where: { organizacionId: user.organizacionId },
    });
    if (!cooperativa) {
      throw new ForbiddenException('El usuario no tiene una cooperativa asociada');
    }
    return cooperativa.id;
  }
}
