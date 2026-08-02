import { Module } from '@nestjs/common';
import { CertificadorasController } from './certificadoras.controller';
import { CertificadosService } from './certificados.service';

@Module({
  controllers: [CertificadorasController],
  providers: [CertificadosService],
})
export class CertificadorasModule {}
