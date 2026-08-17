import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';

interface AuthedRequest {
  user?: { username?: string; [k: string]: unknown };
}

@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  /** Listado paginado de clientes unificados, con búsqueda libre y filtros. */
  @Get()
  findAll(@Query() query: QueryClientesDto) {
    return this.clientes.findAll(query);
  }

  /** Ficha completa de un cliente unificado. */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientes.findOne(id);
  }

  /** Alta de cliente unificado con sus direcciones y teléfonos. */
  @Post()
  create(@Body() dto: CreateClienteDto, @Req() req: AuthedRequest) {
    return this.clientes.create(dto, req.user?.username);
  }

  /** Modificación parcial de la cabecera del cliente. */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClienteDto,
    @Req() req: AuthedRequest,
  ) {
    return this.clientes.update(id, dto, req.user?.username);
  }

  /** Baja lógica del cliente (soft delete). */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientes.softDelete(id);
  }
}
