import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { PublicLotesService } from './public-lotes.service';

// C5: "Consulta pública (QR) — GET /public/lotes/:id — sin autenticación,
// solo lectura". Ver docs/WP-23-plan-codigo-qr.md.
@ApiTags('public')
@Controller('public/lotes')
export class PublicController {
  constructor(private readonly publicLotesService: PublicLotesService) {}

  @Get(':id')
  @Public()
  @ApiOperation({
    summary:
      'Consulta pública del historial de trazabilidad de un lote, sin autenticación',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.publicLotesService.findOne(id);
  }
}
