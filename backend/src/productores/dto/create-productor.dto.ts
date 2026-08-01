import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateProductorDto {
  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @MaxLength(150)
  nombre!: string;

  @ApiProperty({ example: '0912345678', description: '10 dígitos numéricos' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'La cédula debe tener 10 dígitos numéricos' })
  cedula!: string;

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

  @ApiProperty({ example: 500, description: 'Capacidad productiva máxima estimada, en kg' })
  @IsNumber()
  @IsPositive()
  capacidadProductivaMaximaKg!: number;

  @ApiPropertyOptional({
    description:
      'Solo lo usa ADMIN. Si el actor es COOPERATIVA, se ignora y se usa su propia organización.',
  })
  @IsOptional()
  @IsUUID()
  cooperativaId?: string;
}
