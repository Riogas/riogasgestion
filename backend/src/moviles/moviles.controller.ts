import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { MovilesService } from './moviles.service';
import { QueryMovilesDto } from './dto/query-moviles.dto';
import { UpdateMovilDto } from './dto/update-movil.dto';

@ApiTags('moviles')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('moviles')
export class MovilesController {
  constructor(private readonly moviles: MovilesService) {}

  /** Listado paginado de móviles, con filtros. */
  @Get()
  findAll(@Query() query: QueryMovilesDto) {
    return this.moviles.findAll(query);
  }

  /** Totales del panel de móviles. */
  @Get('kpis')
  kpis() {
    return this.moviles.kpis();
  }

  /** Valores disponibles para los filtros del listado de móviles. */
  @Get('filtros')
  filtros() {
    return this.moviles.filtros();
  }

  /** Catálogos de los formularios de móvil: estados, fleteras, servicios y calles. */
  @Get('catalogos')
  catalogos() {
    return this.moviles.catalogos();
  }

  /** Ficha de un móvil con sus sub-recursos. */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.moviles.findOne(id);
  }

  /** Modificación parcial de un móvil. */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMovilDto,
  ) {
    return this.moviles.update(id, dto);
  }

  /** Duplica un móvil con toda su configuración. */
  @Post(':id/duplicar')
  duplicar(@Param('id', ParseIntPipe) id: number) {
    return this.moviles.duplicar(id);
  }
}
