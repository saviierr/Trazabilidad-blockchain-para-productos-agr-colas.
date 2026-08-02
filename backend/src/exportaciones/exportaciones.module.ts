import { Module } from '@nestjs/common';
import { ExportacionesController } from './exportaciones.controller';
import { ExportacionesService } from './exportaciones.service';

@Module({
  controllers: [ExportacionesController],
  providers: [ExportacionesService],
})
export class ExportacionesModule {}
