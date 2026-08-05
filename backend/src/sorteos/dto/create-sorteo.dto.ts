import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

export const ESTADOS_SORTEO = ['borrador', 'activo', 'finalizado', 'cancelado'] as const;

export class CreateSorteoDto {
  @IsString() @Length(3, 120)
  nombre!: string;

  @IsOptional() @IsString() @MaxLength(500)
  descripcion?: string;

  @IsString() @Length(3, 300)
  premioDescripcion!: string;

  @Type(() => Date) @IsDate()
  fechaDesde!: Date;

  // El orden (fechaHasta > fechaDesde) lo valida el service: en el PATCH parcial
  // hay que compararlo contra los valores ya guardados.
  @Type(() => Date) @IsDate()
  fechaHasta!: Date;

  @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  cantidadPremios!: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  maxRegistrosDispositivoDia?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(120)
  edadMinima?: number;
}
