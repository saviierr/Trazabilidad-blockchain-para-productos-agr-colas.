import { Global, Module } from '@nestjs/common';
import { FabricGatewayConfig } from './fabric-gateway.config';
import { FabricGatewayService } from './fabric-gateway.service';

// @Global(): cualquier módulo consumidor (Cooperativas, Certificadoras,
// Transportistas, Exportaciones, Lotes) lo usa sin reimportarlo — mismo
// patrón que CommonModule.
@Global()
@Module({
  providers: [FabricGatewayConfig, FabricGatewayService],
  exports: [FabricGatewayService],
})
export class FabricGatewayModule {}
