import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { LotesService } from './lotes.service';
import { CorregirLoteDto } from './dto/corregir-lote.dto';

// POST /lotes (crear) se retiró en WP-11: el endpoint real per C5 es
// POST /cooperativas/recepcion (ver docs/WP-11-plan-modulo-cooperativas.md §2.1).
@ApiTags('lotes')
@ApiBearerAuth()
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar lotes (alcance "solo propio" por rol, C7)',
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.lotesService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar el detalle de un lote con todas sus relaciones',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lotesService.findOne(id, user);
  }

  @Get(':id/historial')
  @ApiOperation({
    summary: 'Consultar el historial de eventos de un lote, en orden cronológico',
  })
  historial(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lotesService.historial(id, user);
  }

  @Get(':id/blockchain')
  @ApiOperation({
    summary:
      'Leer el lote en vivo desde el ledger (QueryLote) y compararlo contra Postgres (WP-22)',
  })
  blockchain(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lotesService.blockchain(id, user);
  }

  @Get(':id/qr')
  @ApiOperation({
    summary:
      'Generar el código QR del lote (PNG) — payload C6, ver docs/WP-23-plan-codigo-qr.md',
  })
  async qr(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const png = await this.lotesService.generarQr(id, user);
    // res.set() + return no evita que Nest anexe "; charset=utf-8" al
    // Content-Type — se envía la respuesta explícitamente en su lugar.
    res.contentType('image/png').send(png);
  }

  @Put(':id')
  @Roles(RolNombre.ADMIN, RolNombre.COOPERATIVA)
  @ApiOperation({
    summary:
      'Corregir fechaCosecha/pesoInicialKg (C7: Cooperativa propio / Admin). No cambia el estado; crea Evento CORRECCION',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorregirLoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.lotesService.update(id, dto, user);
  }
}
