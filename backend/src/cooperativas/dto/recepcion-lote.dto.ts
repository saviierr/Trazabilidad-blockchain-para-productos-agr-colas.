import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class RecepcionLoteDto {
  @ApiProperty({ description: 'Productor propio de la cooperativa que entrega el cacao' })
  @IsUUID()
  productorId!: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsDateString()
  fechaCosecha!: string;

  @ApiProperty({ example: 350, description: 'Peso recibido, en kg' })
  @IsNumber()
  @IsPositive()
  pesoInicialKg!: number;
}
