import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PuestosController } from './puestos.controller';
import { PuestosService } from './puestos.service';

@Module({
  imports: [PrismaModule],
  controllers: [PuestosController],
  providers: [PuestosService],
  exports: [PuestosService],
})
export class PuestosModule {}
