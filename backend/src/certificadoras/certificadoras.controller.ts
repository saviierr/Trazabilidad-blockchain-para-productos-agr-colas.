import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

// Endpoint de demostración para WP-04. Lógica real (subir PDF, validar
// certificado) se implementa en WP-12.
@ApiTags('certificadoras')
@ApiBearerAuth()
@Controller('certificados')
export class CertificadorasController {
  @Post()
  @Roles(RolNombre.CERTIFICADORA)
  @ApiOperation({ summary: 'Emitir certificado (C7: solo Certificadora)' })
  emitir(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, accion: 'emitir-certificado', actor: user };
  }
}
