import { ApiProperty } from '@nestjs/swagger';
import { EstadoTransporte } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ActualizarEstadoTransporteDto {
  @ApiProperty({ enum: EstadoTransporte, example: EstadoTransporte.ENTREGADO })
  @IsEnum(EstadoTransporte)
  estado!: EstadoTransporte;
}
