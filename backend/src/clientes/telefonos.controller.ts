import {
  Body, Controller, Delete, Param, ParseIntPipe, Patch, Post, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { TelefonosService } from './telefonos.service';
import { TelefonoInputDto } from './dto/telefono-input.dto';
import { UpdateTelefonoDto } from './dto/update-telefono.dto';

@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('clientes/:id/telefonos')
export class TelefonosController {
  constructor(private readonly telefonos: TelefonosService) {}

  @Post()
  add(@Param('id', ParseIntPipe) id: number, @Body() dto: TelefonoInputDto) {
    return this.telefonos.add(id, dto);
  }

  @Patch(':telId')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Param('telId', ParseIntPipe) telId: number,
    @Body() dto: UpdateTelefonoDto,
  ) {
    return this.telefonos.update(id, telId, dto);
  }

  @Delete(':telId')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('telId', ParseIntPipe) telId: number,
  ) {
    return this.telefonos.remove(id, telId);
  }
}
