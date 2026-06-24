import { Module } from '@nestjs/common';
import { CatalogosService } from './catalogos.service';
import { CatalogosController } from './catalogos.controller';

@Module({
  controllers: [CatalogosController],
  providers: [CatalogosService],
  exports: [CatalogosService],
})
export class CatalogosModule {}
