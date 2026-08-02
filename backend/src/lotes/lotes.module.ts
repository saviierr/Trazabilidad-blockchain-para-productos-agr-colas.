import { Module } from '@nestjs/common';
import { LotesController } from './lotes.controller';
import { LotesService } from './lotes.service';

// Máquina de estados C1 completa (WP-11 a WP-14). GET /lotes/:id, GET
// /lotes/:id/historial y PUT /lotes/:id (corrección) implementados en WP-15.
@Module({
  controllers: [LotesController],
  providers: [LotesService],
  exports: [LotesService], // DashboardModule (WP-16) reutiliza buildScopeFilter
})
export class LotesModule {}
