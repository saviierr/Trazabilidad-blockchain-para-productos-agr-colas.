import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsOptional, IsPositive } from 'class-validator';

// Solo los datos capturados en la recepción (WP-11): fermentación/certificación/etc.
// se corrigen dentro de su propio módulo, no aquí (ver docs/WP-15-plan-modulo-lotes.md §2.3).
export class CorregirLoteDto {
  @ApiPropertyOptional({ example: '2026-07-15' })
  @IsOptional()
  @IsDateString()
  fechaCosecha?: string;

  @ApiPropertyOptional({ example: 320 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  pesoInicialKg?: number;
}
