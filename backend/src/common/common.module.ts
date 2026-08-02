import { Global, Module } from '@nestjs/common';
import { OrganizacionContextService } from './organizacion-context.service';

@Global()
@Module({
  providers: [OrganizacionContextService],
  exports: [OrganizacionContextService],
})
export class CommonModule {}
