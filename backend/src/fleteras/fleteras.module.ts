import { Module } from '@nestjs/common';
import { FleterasService } from './fleteras.service';
import { FleterasController } from './fleteras.controller';

@Module({
  controllers: [FleterasController],
  providers: [FleterasService],
  exports: [FleterasService],
})
export class FleterasModule {}
