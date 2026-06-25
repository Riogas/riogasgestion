import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

/** Fila de "Servicios habilitados" → movil_servicio. */
export class ServicioInputDto {
  @IsOptional() @Type(() => Number) @IsInt()
  servicioId?: number;
}
