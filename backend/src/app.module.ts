import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ProductoresModule } from './productores/productores.module';
import { CooperativasModule } from './cooperativas/cooperativas.module';
import { CertificadorasModule } from './certificadoras/certificadoras.module';
import { TransportistasModule } from './transportistas/transportistas.module';
import { ExportacionesModule } from './exportaciones/exportaciones.module';
import { LotesModule } from './lotes/lotes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    HealthModule,
    AuthModule,
    ProductoresModule,
    CooperativasModule,
    CertificadorasModule,
    TransportistasModule,
    ExportacionesModule,
    LotesModule,
  ],
})
export class AppModule {}
