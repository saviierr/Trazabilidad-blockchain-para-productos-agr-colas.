import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { FabricGatewayModule } from './fabric-gateway/fabric-gateway.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { ProductoresModule } from './productores/productores.module';
import { CooperativasModule } from './cooperativas/cooperativas.module';
import { CertificadorasModule } from './certificadoras/certificadoras.module';
import { TransportistasModule } from './transportistas/transportistas.module';
import { ExportacionesModule } from './exportaciones/exportaciones.module';
import { LotesModule } from './lotes/lotes.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PublicModule } from './public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    FabricGatewayModule,
    HealthModule,
    AuthModule,
    ProductoresModule,
    CooperativasModule,
    CertificadorasModule,
    TransportistasModule,
    ExportacionesModule,
    LotesModule,
    DashboardModule,
    PublicModule,
  ],
})
export class AppModule {}
