import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

// cedula y cooperativaId son inmutables (ver docs/WP-10-plan-modulo-productores.md §2.2).
export class UpdateProductorDto {
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nombre?: string;

  @ApiPropertyOptional({ example: '0991234567' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefono?: string;

  @ApiPropertyOptional({ example: 'Recinto El Cacao, Vinces, Los Ríos' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  direccion?: string;

  @ApiPropertyOptional({ example: 550 })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  capacidadProductivaMaximaKg?: number;
}
