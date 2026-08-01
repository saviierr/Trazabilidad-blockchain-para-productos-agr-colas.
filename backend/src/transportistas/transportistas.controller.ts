import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

// Endpoint de demostración para WP-04. Lógica real (estado, incidencias)
// se implementa en WP-13.
@ApiTags('transportistas')
@ApiBearerAuth()
@Controller('transporte')
export class TransportistasController {
  @Post()
  @Roles(RolNombre.TRANSPORTISTA)
  @ApiOperation({ summary: 'Registrar transporte (C7: solo Transportista)' })
  registrar(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, accion: 'registrar-transporte', actor: user };
  }
}
