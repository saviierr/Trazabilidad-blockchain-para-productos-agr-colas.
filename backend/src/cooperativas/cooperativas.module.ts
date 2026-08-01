import { Module } from '@nestjs/common';
import { CooperativasController } from './cooperativas.controller';

// Guards de rol en WP-04. Lógica de recepción/fermentación/secado en WP-11.
@Module({
  controllers: [CooperativasController],
})
export class CooperativasModule {}
