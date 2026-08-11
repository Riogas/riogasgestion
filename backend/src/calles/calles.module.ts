import { Module } from '@nestjs/common';
import { CallesController, CallesApiKeyGuard } from './calles.controller';
import { CallesService } from './calles.service';
import { EsquinasService } from './esquinas.service';

@Module({
  controllers: [CallesController],
  providers: [CallesService, EsquinasService, CallesApiKeyGuard],
  exports: [CallesService],
})
export class CallesModule {}
