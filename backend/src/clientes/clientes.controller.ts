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

  @Get()
  findAll(@Query() query: QueryClientesDto) {
    return this.clientes.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientes.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateClienteDto, @Req() req: AuthedRequest) {
    return this.clientes.create(dto, req.user?.username);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateClienteDto,
    @Req() req: AuthedRequest,
  ) {
    return this.clientes.update(id, dto, req.user?.username);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientes.softDelete(id);
  }
}
