import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { TelefonosService } from './telefonos.service';
import { TelefonosController } from './telefonos.controller';
import { DireccionesService } from './direcciones.service';
import { DireccionesController } from './direcciones.controller';

@Module({
  controllers: [ClientesController, TelefonosController, DireccionesController],
  providers: [ClientesService, TelefonosService, DireccionesService],
  exports: [ClientesService],
})
export class ClientesModule {}
