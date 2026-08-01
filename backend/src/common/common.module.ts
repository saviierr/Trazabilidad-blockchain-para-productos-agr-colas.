import { Global, Module } from '@nestjs/common';
import { CooperativaContextService } from './cooperativa-context.service';

@Global()
@Module({
  providers: [CooperativaContextService],
  exports: [CooperativaContextService],
})
export class CommonModule {}
