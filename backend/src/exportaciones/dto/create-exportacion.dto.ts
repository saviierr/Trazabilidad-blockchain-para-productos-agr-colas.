import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateExportacionDto {
  @ApiProperty({ description: 'Lote a exportar, debe estar en estado En Transporte' })
  @IsUUID()
  loteId!: string;

  @ApiProperty({ example: 'Cacao Trading Co.' })
  @IsString()
  @MaxLength(150)
  empresaCompradora!: string;

  @ApiProperty({ example: 'Bélgica' })
  @IsString()
  @MaxLength(100)
  paisDestino!: string;

  @ApiProperty({ example: 'Puerto de Guayaquil' })
  @IsString()
  @MaxLength(150)
  puertoSalida!: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  fechaExportacion!: string;

  @ApiPropertyOptional({ example: 'DAU-2026-00123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroDocumentoAduanero?: string;
}
