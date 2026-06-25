import { Module } from '@nestjs/common';
import { MovilesService } from './moviles.service';
import { MovilesController } from './moviles.controller';

@Module({
  controllers: [MovilesController],
  providers: [MovilesService],
  exports: [MovilesService],
})
export class MovilesModule {}
