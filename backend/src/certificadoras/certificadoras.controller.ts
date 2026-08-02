import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import type { Response } from 'express';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CertificadosService, UPLOADS_DIR } from './certificados.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

@ApiTags('certificadoras')
@ApiBearerAuth()
@Controller('certificados')
export class CertificadorasController {
  constructor(private readonly certificadosService: CertificadosService) {}

  @Post()
  @Roles(RolNombre.CERTIFICADORA)
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: MAX_PDF_SIZE_BYTES } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Emitir certificado con PDF (C7: solo Certificadora)' })
  create(
    @Body() dto: CreateCertificadoDto,
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificadosService.create(dto, archivo, user);
  }

  @Get()
  @ApiOperation({ summary: 'Consultar certificados (alcance "solo propio")' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.certificadosService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consultar un certificado por id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.certificadosService.findOne(id, user);
  }

  @Get(':id/archivo')
  @ApiOperation({ summary: 'Descargar el PDF del certificado' })
  async descargar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const certificado = await this.certificadosService.findOne(id, user);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="certificado-${id}.pdf"`,
    });
    const stream = createReadStream(
      join(UPLOADS_DIR, `${certificado.hashArchivo}.pdf`),
    );
    return new StreamableFile(stream);
  }
}
