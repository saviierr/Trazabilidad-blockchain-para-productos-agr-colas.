import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { TransportesService } from './transportes.service';
import { CreateTransporteDto } from './dto/create-transporte.dto';
import { ActualizarEstadoTransporteDto } from './dto/actualizar-estado-transporte.dto';
import { CreateIncidenciaDto } from './dto/create-incidencia.dto';

@ApiTags('transportistas')
@ApiBearerAuth()
@Controller('transporte')
export class TransportistasController {
  constructor(private readonly transportesService: TransportesService) {}

  @Post()
  @Roles(RolNombre.TRANSPORTISTA)
  @ApiOperation({ summary: 'Registrar transporte (C7: solo Transportista)' })
  create(
    @Body() dto: CreateTransporteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transportesService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Consultar transportes (alcance "solo propio")' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.transportesService.findAll(user);
  }

  @Put(':id/estado')
  @Roles(RolNombre.TRANSPORTISTA)
  @ApiOperation({ summary: 'Actualizar estado del transporte (propio)' })
  actualizarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActualizarEstadoTransporteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transportesService.actualizarEstado(id, dto, user);
  }

  @Post(':id/incidencias')
  @Roles(RolNombre.TRANSPORTISTA)
  @ApiOperation({ summary: 'Registrar incidencia durante el traslado (propio)' })
  registrarIncidencia(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateIncidenciaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.transportesService.registrarIncidencia(id, dto, user);
  }
}
