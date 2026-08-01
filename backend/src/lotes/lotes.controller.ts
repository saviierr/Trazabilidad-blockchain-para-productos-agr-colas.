import { Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';

// Endpoints de demostración para WP-04 (guards de auth/roles). La lógica real
// de creación y consulta de lotes (Prisma, DTOs, máquina de estados C1) se
// implementa en WP-15.
@ApiTags('lotes')
@ApiBearerAuth()
@Controller('lotes')
export class LotesController {
  @Post()
  @Roles(RolNombre.COOPERATIVA)
  @ApiOperation({ summary: 'Crear lote (C7: solo Cooperativa)' })
  crear(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, accion: 'crear-lote', actor: user };
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar historial de lotes (cualquier rol autenticado)',
  })
  listar(@CurrentUser() user: AuthenticatedUser) {
    return { ok: true, accion: 'listar-lotes', actor: user };
  }
}
