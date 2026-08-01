import { Module } from '@nestjs/common';
import { ExportacionesController } from './exportaciones.controller';

// Guards de rol en WP-04. Registro de exportación en WP-14.
@Module({
  controllers: [ExportacionesController],
})
export class ExportacionesModule {}
