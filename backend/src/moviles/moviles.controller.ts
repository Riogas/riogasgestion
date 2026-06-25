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

  @Get()
  findAll(@Query() query: QueryMovilesDto) {
    return this.moviles.findAll(query);
  }

  @Get('kpis')
  kpis() {
    return this.moviles.kpis();
  }

  @Get('filtros')
  filtros() {
    return this.moviles.filtros();
  }

  @Get('catalogos')
  catalogos() {
    return this.moviles.catalogos();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.moviles.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMovilDto,
  ) {
    return this.moviles.update(id, dto);
  }

  @Post(':id/duplicar')
  duplicar(@Param('id', ParseIntPipe) id: number) {
    return this.moviles.duplicar(id);
  }
}
