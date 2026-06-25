import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/** Fila de "Ptos de recarga" → movil_punto_recarga. */
export class PuntoInputDto {
  @IsOptional() @IsString() @MaxLength(60)
  nombre?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  puntoId?: number;
}
