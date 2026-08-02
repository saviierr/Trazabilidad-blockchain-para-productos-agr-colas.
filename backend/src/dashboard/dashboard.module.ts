import { Module } from '@nestjs/common';
import { LotesModule } from '../lotes/lotes.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

// Cierra Sprint 1 (WP-16): indicadores agregados sobre los módulos ya
// construidos, reutilizando el alcance "solo propio" de LotesService (WP-15).
@Module({
  imports: [LotesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
