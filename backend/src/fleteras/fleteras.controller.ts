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

  @Get()
  findAll(@Query() query: QueryFleterasDto) {
    return this.fleteras.findAll(query);
  }

  @Get('kpis')
  kpis() {
    return this.fleteras.kpis();
  }

  @Get('filtros')
  filtros() {
    return this.fleteras.filtros();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.fleteras.findOne(id);
  }
}
