import {
  Body, Controller, Delete, Param, ParseIntPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { ProductosService } from './productos.service';
import { PuntosService } from './puntos.service';
import { ServiciosMovilService } from './servicios.service';
import { EscenariosService } from './escenarios.service';
import { ProductoInputDto } from './dto/producto-input.dto';
import { PuntoInputDto } from './dto/punto-input.dto';
import { ServicioInputDto } from './dto/servicio-input.dto';
import { EscenarioInputDto } from './dto/escenario-input.dto';

@ApiTags('moviles')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('moviles/:id/productos')
export class ProductosController {
  constructor(private readonly productos: ProductosService) {}

  @Post()
  add(@Param('id', ParseIntPipe) id: number, @Body() dto: ProductoInputDto) {
    return this.productos.add(id, dto);
  }

  @Patch(':subId')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Param('subId', ParseIntPipe) subId: number,
    @Body() dto: ProductoInputDto,
  ) {
    return this.productos.update(id, subId, dto);
  }

  @Delete(':subId')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('subId', ParseIntPipe) subId: number,
  ) {
    return this.productos.remove(id, subId);
  }
}

@ApiTags('moviles')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('moviles/:id/puntos')
export class PuntosController {
  constructor(private readonly puntos: PuntosService) {}

  @Post()
  add(@Param('id', ParseIntPipe) id: number, @Body() dto: PuntoInputDto) {
    return this.puntos.add(id, dto);
  }

  @Patch(':subId')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Param('subId', ParseIntPipe) subId: number,
    @Body() dto: PuntoInputDto,
  ) {
    return this.puntos.update(id, subId, dto);
  }

  @Delete(':subId')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('subId', ParseIntPipe) subId: number,
  ) {
    return this.puntos.remove(id, subId);
  }
}

@ApiTags('moviles')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('moviles/:id/servicios')
export class ServiciosController {
  constructor(private readonly servicios: ServiciosMovilService) {}

  @Post()
  add(@Param('id', ParseIntPipe) id: number, @Body() dto: ServicioInputDto) {
    return this.servicios.add(id, dto);
  }

  @Patch(':subId')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Param('subId', ParseIntPipe) subId: number,
    @Body() dto: ServicioInputDto,
  ) {
    return this.servicios.update(id, subId, dto);
  }

  @Delete(':subId')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('subId', ParseIntPipe) subId: number,
  ) {
    return this.servicios.remove(id, subId);
  }
}

@ApiTags('moviles')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('moviles/:id/escenarios')
export class EscenariosController {
  constructor(private readonly escenarios: EscenariosService) {}

  @Post()
  add(@Param('id', ParseIntPipe) id: number, @Body() dto: EscenarioInputDto) {
    return this.escenarios.add(id, dto);
  }

  @Patch(':subId')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Param('subId', ParseIntPipe) subId: number,
    @Body() dto: EscenarioInputDto,
  ) {
    return this.escenarios.update(id, subId, dto);
  }

  @Delete(':subId')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('subId', ParseIntPipe) subId: number,
  ) {
    return this.escenarios.remove(id, subId);
  }
}
