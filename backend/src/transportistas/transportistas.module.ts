import { Module } from '@nestjs/common';
import { TransportistasController } from './transportistas.controller';

// Guards de rol en WP-04. Registro de transporte/incidencias en WP-13.
@Module({
  controllers: [TransportistasController],
})
export class TransportistasModule {}
