import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateIncidenciaDto {
  @ApiProperty({ example: 'Retraso de 3 horas por lluvia en la vía' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  descripcion!: string;
}
