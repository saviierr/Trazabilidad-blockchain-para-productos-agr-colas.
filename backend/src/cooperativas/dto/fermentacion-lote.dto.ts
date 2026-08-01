import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class FermentacionLoteDto {
  @ApiProperty({ description: 'Lote propio de la cooperativa, en estado Creado' })
  @IsUUID()
  loteId!: string;

  @ApiProperty({
    example: 280,
    description: 'Peso post-fermentación/secado, en kg (C4.RegisterFermentation)',
  })
  @IsNumber()
  @IsPositive()
  peso!: number;

  @ApiProperty({ example: '2026-07-22' })
  @IsDateString()
  fechaSecado!: string;
}
