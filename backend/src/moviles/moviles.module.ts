import { Module } from '@nestjs/common';
import { MovilesService } from './moviles.service';
import { MovilesController } from './moviles.controller';
import { ProductosService } from './productos.service';
import { PuntosService } from './puntos.service';
import { ServiciosMovilService } from './servicios.service';
import { EscenariosService } from './escenarios.service';
import {
  ProductosController,
  PuntosController,
  ServiciosController,
  EscenariosController,
} from './subrecursos.controller';

@Module({
  controllers: [
    MovilesController,
    ProductosController,
    PuntosController,
    ServiciosController,
    EscenariosController,
  ],
  providers: [
    MovilesService,
    ProductosService,
    PuntosService,
    ServiciosMovilService,
    EscenariosService,
  ],
  exports: [MovilesService],
})
export class MovilesModule {}
