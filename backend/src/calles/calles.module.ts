import { Module } from '@nestjs/common';
import { CallesController, CallesApiKeyGuard } from './calles.controller';
import { CallesService } from './calles.service';
import { EsquinasService } from './esquinas.service';

@Module({
  controllers: [CallesController],
  providers: [CallesService, EsquinasService, CallesApiKeyGuard],
  // El módulo `mostrador` reusa los dos: un solo índice de calles en memoria y
  // una sola caché de Nominatim para toda la app.
  exports: [CallesService, EsquinasService],
})
export class CallesModule {}
