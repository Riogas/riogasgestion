import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { PuestosService } from './puestos.service';
import { QueryPuestosDto } from './dto/query-puestos.dto';
import { CreatePuestoDto, UpdatePuestoDto } from './dto/upsert-puesto.dto';

@ApiTags('puestos')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('puestos')
export class PuestosController {
  constructor(private readonly puestos: PuestosService) {}

  /** Listado paginado de puestos, con filtros. */
  @Get()
  findAll(@Query() query: QueryPuestosDto) {
    return this.puestos.findAll(query);
  }

  /** Totales del panel de puestos. */
  @Get('kpis')
  kpis() {
    return this.puestos.kpis();
  }

  /** Valores disponibles para los filtros del listado de puestos. */
  @Get('filtros')
  filtros() {
    return this.puestos.filtros();
  }

  /** Ficha de un puesto. */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.puestos.findOne(id);
  }

  /** Alta de puesto. */
  @Post()
  create(@Body() dto: CreatePuestoDto) {
    return this.puestos.create(dto);
  }

  /** Modificación parcial de un puesto. */
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePuestoDto) {
    return this.puestos.update(id, dto);
  }
}
