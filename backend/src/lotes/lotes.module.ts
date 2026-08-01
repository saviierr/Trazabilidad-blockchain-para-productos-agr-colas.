import { Module } from '@nestjs/common';
import { LotesController } from './lotes.controller';

// Guards de rol en WP-04. Máquina de estados C1 y lógica real en WP-15.
@Module({
  controllers: [LotesController],
})
export class LotesModule {}
