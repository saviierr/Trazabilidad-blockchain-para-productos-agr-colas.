import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { LotesService } from './lotes.service';

// POST /lotes (crear) se retiró en WP-11: el endpoint real per C5 es
// POST /cooperativas/recepcion (ver docs/WP-11-plan-modulo-cooperativas.md §2.1).
@ApiTags('lotes')
@ApiBearerAuth()
@Controller('lotes')
export class LotesController {
  constructor(private readonly lotesService: LotesService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar lotes (alcance "solo propio" para Cooperativa/Productor)',
  })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.lotesService.findAll(user);
  }
}
