import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

// Todos los campos opcionales (PATCH). El estado no se cambia acá: va por
// activar / finalizar / cancelar, que tienen sus propias reglas de transición.
export class UpdateSorteoDto {
  @IsOptional() @IsString() @Length(3, 120)
  nombre?: string;

  @IsOptional() @IsString() @MaxLength(500)
  descripcion?: string;

  @IsOptional() @IsString() @Length(3, 300)
  premioDescripcion?: string;

  @IsOptional() @Type(() => Date) @IsDate()
  fechaDesde?: Date;

  @IsOptional() @Type(() => Date) @IsDate()
  fechaHasta?: Date;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  cantidadPremios?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  maxRegistrosDispositivoDia?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(120)
  edadMinima?: number;
}
