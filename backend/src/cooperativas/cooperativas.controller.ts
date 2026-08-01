import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

// Endpoint de demostración para WP-04. Lógica real (recepción, peso,
// fermentación, secado) se implementa en WP-11.
@ApiTags('cooperativas')
@ApiBearerAuth()
@Controller('cooperativas')
export class CooperativasController {
  @Post('fermentacion')
  @Roles(RolNombre.COOPERATIVA)
  @ApiOperation({
    summary: 'Registrar fermentación/secado (C7: solo Cooperativa)',
  })
  registrarFermentacion(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, accion: 'registrar-fermentacion', actor: user };
  }
}
