import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';
import { CreateTelefonoDto } from './dto/create-telefono.dto';
import { UpdateTelefonoDto } from './dto/update-telefono.dto';
import { CreateDireccionDto } from './dto/create-direccion.dto';
import { UpdateDireccionDto } from './dto/update-direccion.dto';

@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  findAll(@Query() query: QueryClientesDto) {
    return this.clientes.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateClienteDto) {
    return this.clientes.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClienteDto) {
    return this.clientes.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.remove(id);
  }

  // --- Teléfonos ---
  @Post(':id/telefonos')
  addTelefono(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTelefonoDto) {
    return this.clientes.addTelefono(id, dto);
  }

  @Patch(':id/telefonos/:telId')
  updateTelefono(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('telId', ParseUUIDPipe) telId: string,
    @Body() dto: UpdateTelefonoDto,
  ) {
    return this.clientes.updateTelefono(id, telId, dto);
  }

  @Delete(':id/telefonos/:telId')
  removeTelefono(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('telId', ParseUUIDPipe) telId: string,
  ) {
    return this.clientes.removeTelefono(id, telId);
  }

  // --- Direcciones ---
  @Post(':id/direcciones')
  addDireccion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDireccionDto) {
    return this.clientes.addDireccion(id, dto);
  }

  @Patch(':id/direcciones/:dirId')
  updateDireccion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dirId', ParseUUIDPipe) dirId: string,
    @Body() dto: UpdateDireccionDto,
  ) {
    return this.clientes.updateDireccion(id, dirId, dto);
  }

  @Delete(':id/direcciones/:dirId')
  removeDireccion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dirId', ParseUUIDPipe) dirId: string,
  ) {
    return this.clientes.removeDireccion(id, dirId);
  }
}
