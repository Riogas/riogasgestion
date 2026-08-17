import {
  Controller, Get, Param, ParseIntPipe, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { FleterasService } from './fleteras.service';
import { QueryFleterasDto } from './dto/query-fleteras.dto';

@ApiTags('fleteras')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('fleteras')
export class FleterasController {
  constructor(private readonly fleteras: FleterasService) {}

  /** Listado paginado de empresas fleteras, con filtros. */
  @Get()
  findAll(@Query() query: QueryFleterasDto) {
    return this.fleteras.findAll(query);
  }

  /** Totales del panel de fleteras. */
  @Get('kpis')
  kpis() {
    return this.fleteras.kpis();
  }

  /** Valores disponibles para los filtros del listado de fleteras. */
  @Get('filtros')
  filtros() {
    return this.fleteras.filtros();
  }

  /** Ficha de una empresa fletera. */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.fleteras.findOne(id);
  }
}
