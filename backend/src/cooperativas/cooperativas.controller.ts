import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CooperativasService } from './cooperativas.service';
import { RecepcionLoteDto } from './dto/recepcion-lote.dto';
import { FermentacionLoteDto } from './dto/fermentacion-lote.dto';

@ApiTags('cooperativas')
@ApiBearerAuth()
@Controller('cooperativas')
export class CooperativasController {
  constructor(private readonly cooperativasService: CooperativasService) {}

  @Post('recepcion')
  @Roles(RolNombre.COOPERATIVA)
  @ApiOperation({ summary: 'Registrar recepción de un lote (C7: solo Cooperativa)' })
  recepcion(
    @Body() dto: RecepcionLoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cooperativasService.recepcion(dto, user);
  }

  @Post('fermentacion')
  @Roles(RolNombre.COOPERATIVA)
  @ApiOperation({
    summary: 'Registrar fermentación/secado (C7: solo Cooperativa)',
  })
  registrarFermentacion(
    @Body() dto: FermentacionLoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.cooperativasService.registrarFermentacion(dto, user);
  }
}
