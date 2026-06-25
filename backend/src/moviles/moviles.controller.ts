import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { MovilesService } from './moviles.service';
import { QueryMovilesDto } from './dto/query-moviles.dto';

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

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.moviles.findOne(id);
  }
}
