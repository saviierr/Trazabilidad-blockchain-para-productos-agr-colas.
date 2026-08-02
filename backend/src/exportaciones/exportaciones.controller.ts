import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

// Endpoint de demostración para WP-04. Lógica real (empresa, país destino,
// fecha) se implementa en WP-14.
@ApiTags('exportaciones')
@ApiBearerAuth()
@Controller('exportaciones')
export class ExportacionesController {
  @Post()
  @Roles(RolNombre.EXPORTADOR)
  @ApiOperation({ summary: 'Registrar exportación (C7: solo Exportador)' })
  registrar(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, accion: 'registrar-exportacion', actor: user };
  }
}
