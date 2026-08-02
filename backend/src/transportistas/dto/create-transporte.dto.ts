import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTransporteDto {
  @ApiProperty({ description: 'Lote a transportar, debe estar en estado Certificado' })
  @IsUUID()
  loteId!: string;

  @ApiProperty({ example: 'Vinces — Puerto de Guayaquil' })
  @IsString()
  @MaxLength(255)
  ruta!: string;

  @ApiProperty({ example: '2026-08-05' })
  @IsDateString()
  fechaSalida!: string;

  @ApiPropertyOptional({ example: '2026-08-07' })
  @IsOptional()
  @IsDateString()
  fechaLlegadaEstimada?: string;
}
