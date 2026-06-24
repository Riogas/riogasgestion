import {
  Body, Controller, Delete, Param, ParseIntPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { DireccionesService } from './direcciones.service';
import { DireccionInputDto } from './dto/direccion-input.dto';
import { UpdateDireccionDto } from './dto/update-direccion.dto';

@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('clientes/:id/direcciones')
export class DireccionesController {
  constructor(private readonly direcciones: DireccionesService) {}

  @Post()
  add(@Param('id', ParseIntPipe) id: number, @Body() dto: DireccionInputDto) {
    return this.direcciones.add(id, dto);
  }

  @Patch(':dirId')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Param('dirId', ParseIntPipe) dirId: number,
    @Body() dto: UpdateDireccionDto,
  ) {
    return this.direcciones.update(id, dirId, dto);
  }

  @Delete(':dirId')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('dirId', ParseIntPipe) dirId: number,
  ) {
    return this.direcciones.remove(id, dirId);
  }
}
