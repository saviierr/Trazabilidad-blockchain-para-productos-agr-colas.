import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ExportacionesService } from './exportaciones.service';
import { CreateExportacionDto } from './dto/create-exportacion.dto';

@ApiTags('exportaciones')
@ApiBearerAuth()
@Controller('exportaciones')
export class ExportacionesController {
  constructor(private readonly exportacionesService: ExportacionesService) {}

  @Post()
  @Roles(RolNombre.EXPORTADOR)
  @ApiOperation({ summary: 'Registrar exportación (C7: solo Exportador)' })
  create(
    @Body() dto: CreateExportacionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.exportacionesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Consultar exportaciones (alcance "solo propio")' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.exportacionesService.findAll(user);
  }
}
