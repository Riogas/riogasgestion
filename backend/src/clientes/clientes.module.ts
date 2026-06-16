import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { ClienteTelefono } from './entities/cliente-telefono.entity';
import { ClienteDireccion } from './entities/cliente-direccion.entity';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { ImportPadronService } from './import/import-padron.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, ClienteTelefono, ClienteDireccion])],
  controllers: [ClientesController],
  providers: [ClientesService, ImportPadronService],
  exports: [ClientesService, ImportPadronService],
})
export class ClientesModule {}
