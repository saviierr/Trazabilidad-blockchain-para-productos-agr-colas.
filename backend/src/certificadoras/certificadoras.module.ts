import { Module } from '@nestjs/common';
import { CertificadorasController } from './certificadoras.controller';

// Guards de rol en WP-04. Registro/validación de certificados en WP-12.
@Module({
  controllers: [CertificadorasController],
})
export class CertificadorasModule {}
