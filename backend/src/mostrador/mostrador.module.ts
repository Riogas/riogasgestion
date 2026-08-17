import { Module } from '@nestjs/common';
import { CallesModule } from '../calles/calles.module';
import { As400Client } from './as400.client';
import {
  MostradorApiKeyGuard,
  MostradorController,
  SesionMostradorGuard,
} from './mostrador.controller';
import { MostradorService } from './mostrador.service';
import { SesionService } from './sesion.service';

/**
 * Ficha de mostrador: el orquestador entre el AS400 (fuente de verdad del VB6)
 * y goya. Reusa el índice de calles y el resolvedor de esquinas del módulo
 * `calles` — un solo índice en memoria, una sola caché de Nominatim.
 */
@Module({
  imports: [CallesModule],
  controllers: [MostradorController],
  providers: [
    MostradorService,
    As400Client,
    SesionService,
    MostradorApiKeyGuard,
    SesionMostradorGuard,
  ],
})
export class MostradorModule {}
