import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RolNombre } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { ProductoresService } from './productores.service';
import { CreateProductorDto } from './dto/create-productor.dto';
import { UpdateProductorDto } from './dto/update-productor.dto';

@ApiTags('productores')
@ApiBearerAuth()
@Controller('productores')
export class ProductoresController {
  constructor(private readonly productoresService: ProductoresService) {}

  @Post()
  @Roles(RolNombre.ADMIN, RolNombre.COOPERATIVA)
  @ApiOperation({ summary: 'Registrar un productor' })
  create(
    @Body() dto: CreateProductorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productoresService.create(dto, user);
  }

  @Get()
  @Roles(RolNombre.ADMIN, RolNombre.COOPERATIVA, RolNombre.PRODUCTOR)
  @ApiQuery({ name: 'incluirInactivos', required: false, type: Boolean })
  @ApiOperation({ summary: 'Consultar productores (alcance "solo propio")' })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('incluirInactivos') incluirInactivos?: string,
  ) {
    return this.productoresService.findAll(user, incluirInactivos === 'true');
  }

  @Get(':id')
  @Roles(RolNombre.ADMIN, RolNombre.COOPERATIVA, RolNombre.PRODUCTOR)
  @ApiOperation({ summary: 'Consultar un productor por id' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productoresService.findOne(id, user);
  }

  @Put(':id')
  @Roles(RolNombre.ADMIN, RolNombre.COOPERATIVA)
  @ApiOperation({ summary: 'Actualizar un productor' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productoresService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(RolNombre.ADMIN, RolNombre.COOPERATIVA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar un productor (lógico, activo = false)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productoresService.softDelete(id, user);
  }
}
