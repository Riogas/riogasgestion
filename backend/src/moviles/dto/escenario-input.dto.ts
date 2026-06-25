import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

/** Fila de "Escenarios y prioridad" → movil_zona. */
export class EscenarioInputDto {
  @IsOptional() @Type(() => Number) @IsInt()
  escenarioId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  canalId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  zonaId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  tipo?: number;
}
