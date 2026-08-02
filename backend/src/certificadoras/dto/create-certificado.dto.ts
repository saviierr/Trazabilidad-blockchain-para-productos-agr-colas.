import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

// El archivo PDF llega vía FileInterceptor('archivo'), no forma parte de este DTO.
export class CreateCertificadoDto {
  @ApiProperty({ description: 'Lote a certificar, debe estar en estado Fermentando' })
  @IsUUID()
  loteId!: string;

  @ApiProperty({ example: 'Orgánico' })
  @IsString()
  @MaxLength(100)
  tipoCertificacion!: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsDateString()
  fechaEmision!: string;

  @ApiPropertyOptional({ example: '2027-08-01' })
  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;
}
