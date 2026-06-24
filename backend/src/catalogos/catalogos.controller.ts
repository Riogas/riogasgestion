import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { CatalogosService } from './catalogos.service';

@ApiTags('catalogos')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogos: CatalogosService) {}

  @Get('tipos-cliente')
  tiposCliente() {
    return this.catalogos.tiposCliente();
  }

  @Get('categorias-precio')
  categoriasPrecio() {
    return this.catalogos.categoriasPrecio();
  }

  @Get('departamentos')
  departamentos() {
    return this.catalogos.departamentos();
  }

  @Get('localidades')
  localidades(@Query('departamentoId') departamentoId?: string) {
    const id = departamentoId !== undefined ? Number(departamentoId) : undefined;
    return this.catalogos.localidades(Number.isNaN(id as number) ? undefined : id);
  }

  @Get('zonas')
  zonas(@Query('puestoId') puestoId?: string) {
    const id = puestoId !== undefined ? Number(puestoId) : undefined;
    return this.catalogos.zonas(Number.isNaN(id as number) ? undefined : id);
  }

  @Get('puestos')
  puestos() {
    return this.catalogos.puestos();
  }
}
