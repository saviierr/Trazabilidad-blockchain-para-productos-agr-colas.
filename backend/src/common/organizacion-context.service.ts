import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

// Resuelve el usuario autenticado de un rol organizacional (Usuario.organizacionId)
// a la fila de su entidad específica (Cooperativa, Certificadora, ...). Compartido
// entre los servicios de cada módulo para no duplicar el mismo lookup — ver
// docs/WP-11-plan-modulo-cooperativas.md §4 y docs/WP-12-plan-modulo-certificadoras.md §2.7.
@Injectable()
export class OrganizacionContextService {
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

  async resolveCertificadoraId(user: AuthenticatedUser): Promise<string> {
    if (!user.organizacionId) {
      throw new ForbiddenException('El usuario no tiene una organización asociada');
    }
    const certificadora = await this.prisma.certificadora.findUnique({
      where: { organizacionId: user.organizacionId },
    });
    if (!certificadora) {
      throw new ForbiddenException('El usuario no tiene una certificadora asociada');
    }
    return certificadora.id;
  }

  async resolveTransportistaId(user: AuthenticatedUser): Promise<string> {
    if (!user.organizacionId) {
      throw new ForbiddenException('El usuario no tiene una organización asociada');
    }
    const transportista = await this.prisma.transportista.findUnique({
      where: { organizacionId: user.organizacionId },
    });
    if (!transportista) {
      throw new ForbiddenException('El usuario no tiene una transportista asociada');
    }
    return transportista.id;
  }
}
