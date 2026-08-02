import { Module } from '@nestjs/common';
import { TransportistasController } from './transportistas.controller';
import { TransportesService } from './transportes.service';

@Module({
  controllers: [TransportistasController],
  providers: [TransportesService],
})
export class TransportistasModule {}
