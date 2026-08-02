import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { EstadoLote, Prisma, RolNombre, TipoEvento } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizacionContextService } from '../common/organizacion-context.service';
import { FabricGatewayService } from '../fabric-gateway/fabric-gateway.service';
import { OrgChaincode } from '../fabric-gateway/types';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import type { CreateCertificadoDto } from './dto/create-certificado.dto';

// Almacenamiento off-chain en disco local (WP-12 §2.1). Migrar a object storage
// real (S3/MinIO) queda fuera de alcance del MVP.
export const UPLOADS_DIR = join(process.cwd(), 'uploads', 'certificados');

const INCLUDE_CERTIFICADO = {
  lote: { include: { productor: true, cooperativa: { include: { organizacion: true } } } },
  certificadora: { include: { organizacion: true } },
} satisfies Prisma.CertificadoInclude;

@Injectable()
export class CertificadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizacionContext: OrganizacionContextService,
    private readonly fabricGateway: FabricGatewayService,
  ) {}

  async create(
    dto: CreateCertificadoDto,
    archivo: Express.Multer.File,
    user: AuthenticatedUser,
  ) {
    if (!archivo) {
      throw new BadRequestException('El archivo PDF del certificado es requerido');
    }
    if (archivo.mimetype !== 'application/pdf') {
      throw new BadRequestException('El archivo debe ser un PDF');
    }

    const lote = await this.prisma.lote.findUnique({ where: { id: dto.loteId } });
    if (!lote) {
      throw new NotFoundException('Lote no encontrado');
    }
    if (lote.estado !== EstadoLote.FERMENTANDO) {
      throw new ConflictException(
        `El lote está en estado ${lote.estado}; solo se puede certificar desde Fermentando`,
      );
    }

    const certificadoraId =
      await this.organizacionContext.resolveCertificadoraId(user);

    const hash = createHash('sha256').update(archivo.buffer).digest('hex');

    // WP-22 §2.4/§2.7: el chaincode se invoca antes de cualquier escritura
    // (ni disco ni Postgres) — si lo rechaza, no queda nada a medias. Sin
    // PKI de documento (§2.7): se reutiliza el mismo hash SHA-256 como
    // `firmaCertificadora`.
    const { transactionId } = await this.fabricGateway.submit(
      OrgChaincode.CERTIFICADORA,
      'RegisterCertification',
      lote.id,
      hash,
      hash,
    );

    mkdirSync(UPLOADS_DIR, { recursive: true });
    writeFileSync(join(UPLOADS_DIR, `${hash}.pdf`), archivo.buffer);

    // El lote se actualiza antes de crear+incluir el certificado para que la
    // respuesta refleje el estado ya transicionado (Prisma resuelve `include`
    // con el estado de la fila al momento de la consulta, no al momento de la
    // llamada — si se actualiza después, la respuesta queda con el estado viejo).
    await this.prisma.lote.update({
      where: { id: lote.id },
      data: {
        estado: EstadoLote.CERTIFICADO,
        hashCertificado: hash,
        ultimaTxHashBlockchain: transactionId,
      },
    });

    const id = randomUUID();
    const certificado = await this.prisma.certificado.create({
      data: {
        id,
        loteId: lote.id,
        certificadoraId,
        tipoCertificacion: dto.tipoCertificacion,
        archivoPdfUrl: `/certificados/${id}/archivo`,
        hashArchivo: hash,
        fechaEmision: new Date(dto.fechaEmision),
        fechaVencimiento: dto.fechaVencimiento
          ? new Date(dto.fechaVencimiento)
          : undefined,
      },
      include: INCLUDE_CERTIFICADO,
    });

    await this.prisma.evento.create({
      data: {
        loteId: lote.id,
        tipo: TipoEvento.CERTIFICACION,
        actorUsuarioId: user.id,
        actorOrganizacionId: user.organizacionId,
        datosEspecificos: {
          tipoCertificacion: dto.tipoCertificacion,
          hashArchivo: hash,
        },
        hashTransaccionBlockchain: transactionId,
      },
    });

    return certificado;
  }

  async findAll(user: AuthenticatedUser) {
    const where: Prisma.CertificadoWhereInput = await this.buildScopeFilter(user);
    return this.prisma.certificado.findMany({
      where,
      include: INCLUDE_CERTIFICADO,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const where = await this.buildScopeFilter(user);
    const certificado = await this.prisma.certificado.findFirst({
      where: { ...where, id },
      include: INCLUDE_CERTIFICADO,
    });
    if (!certificado) {
      throw new NotFoundException('Certificado no encontrado');
    }
    return certificado;
  }

  // "Solo propio" (C7, §2.7 del plan): filtra por lo que cada rol puede ver,
  // no por lo que puede certificar (no hay relación de pertenencia entre
  // Certificadora y Lote — ver §2 del plan).
  private async buildScopeFilter(
    user: AuthenticatedUser,
  ): Promise<Prisma.CertificadoWhereInput> {
    if (user.rol === RolNombre.CERTIFICADORA) {
      return {
        certificadoraId: await this.organizacionContext.resolveCertificadoraId(user),
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
    return {}; // ADMIN y el resto: sin filtro (ver §2.7)
  }
}
