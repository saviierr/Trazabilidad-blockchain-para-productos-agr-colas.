import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RolNombre, type Productor } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { CreateProductorDto } from './dto/create-productor.dto';
import type { UpdateProductorDto } from './dto/update-productor.dto';

const INCLUDE_COOPERATIVA = {
  cooperativa: { include: { organizacion: true } },
} satisfies Prisma.ProductorInclude;

@Injectable()
export class ProductoresService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductorDto, user: AuthenticatedUser) {
    const cooperativaId =
      user.rol === RolNombre.COOPERATIVA
        ? await this.resolveCooperativaId(user)
        : dto.cooperativaId;

    if (!cooperativaId) {
      throw new BadRequestException(
        'cooperativaId es requerido cuando el actor es ADMIN',
      );
    }

    return this.prisma.productor.create({
      data: {
        nombre: dto.nombre,
        cedula: dto.cedula,
        telefono: dto.telefono,
        direccion: dto.direccion,
        capacidadProductivaMaximaKg: dto.capacidadProductivaMaximaKg,
        cooperativaId,
      },
      include: INCLUDE_COOPERATIVA,
    });
  }

  async findAll(user: AuthenticatedUser, incluirInactivos: boolean) {
    const where: Prisma.ProductorWhereInput = {};
    if (!incluirInactivos) {
      where.activo = true;
    }

    if (user.rol === RolNombre.COOPERATIVA) {
      where.cooperativaId = await this.resolveCooperativaId(user);
    } else if (user.rol === RolNombre.PRODUCTOR) {
      where.usuarioId = user.id;
    }
    // ADMIN: sin filtro adicional, ve todos.

    return this.prisma.productor.findMany({
      where,
      include: INCLUDE_COOPERATIVA,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const productor = await this.prisma.productor.findUnique({
      where: { id },
      include: INCLUDE_COOPERATIVA,
    });
    if (!productor) {
      throw new NotFoundException('Productor no encontrado');
    }
    await this.assertAccess(productor, user);
    return productor;
  }

  async update(id: string, dto: UpdateProductorDto, user: AuthenticatedUser) {
    await this.findOne(id, user);
    return this.prisma.productor.update({
      where: { id },
      data: dto,
      include: INCLUDE_COOPERATIVA,
    });
  }

  async softDelete(id: string, user: AuthenticatedUser) {
    await this.findOne(id, user);
    return this.prisma.productor.update({
      where: { id },
      data: { activo: false },
      include: INCLUDE_COOPERATIVA,
    });
  }

  // Resuelve el usuario COOPERATIVA autenticado (organizacionId) a su fila Cooperativa.id.
  private async resolveCooperativaId(user: AuthenticatedUser): Promise<string> {
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

  // "Solo propio" (C7): 404 en vez de 403 para no filtrar la existencia de
  // productores de otra cooperativa.
  private async assertAccess(productor: Productor, user: AuthenticatedUser) {
    if (user.rol === RolNombre.ADMIN) {
      return;
    }
    if (user.rol === RolNombre.COOPERATIVA) {
      const cooperativaId = await this.resolveCooperativaId(user);
      if (productor.cooperativaId !== cooperativaId) {
        throw new NotFoundException('Productor no encontrado');
      }
      return;
    }
    if (user.rol === RolNombre.PRODUCTOR) {
      if (productor.usuarioId !== user.id) {
        throw new NotFoundException('Productor no encontrado');
      }
      return;
    }
    throw new ForbiddenException('El rol no tiene acceso a este recurso');
  }
}
