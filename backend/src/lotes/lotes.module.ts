import { Module } from '@nestjs/common';
import { LotesController } from './lotes.controller';
import { LotesService } from './lotes.service';

// Máquina de estados C1 completa y GET /lotes/:id/historial en WP-15.
@Module({
  controllers: [LotesController],
  providers: [LotesService],
})
export class LotesModule {}
