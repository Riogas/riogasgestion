import { Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * Alta de puesto.
 *
 * `id` es obligatorio y lo elige quien crea: la tabla `puesto` NO tiene
 * autoincremental (los ids vienen del AS400: 1, 2, 4, 5 … 100, 1000), así que
 * un create sin id explícito rompe.
 *
 * Los flags del legado viajan como 'S'/'N' de un caracter, no como booleanos.
 */
export class CreatePuestoDto {
  @Type(() => Number) @IsInt() @Min(1)
  id!: number;

  @IsString() @Length(1, 40)
  nombre!: string;

  @Type(() => Number) @IsInt()
  departamentoId!: number;

  @IsOptional() @IsString() @MaxLength(100)
  direccion?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  localidadId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  zonaId?: number;

  @IsOptional() @IsEmail({}, { message: 'El email no tiene un formato válido' }) @MaxLength(100)
  mail?: string;

  @IsOptional() @IsString() @MaxLength(20)
  telefono?: string;

  @IsOptional() @IsIn(['S', 'N'])
  propio?: string;

  @IsOptional() @IsIn(['S', 'N'])
  autopedido?: string;

  @IsOptional() @IsIn(['S', 'N'])
  fleteCobra?: string;

  @IsOptional() @IsString() @MaxLength(2)
  fleteCantidad?: string;

  @IsOptional() @IsString() @MaxLength(200)
  horarios?: string;

  // Lat y lng son "todo o nada": una sola coordenada no ubica nada y dejaría
  // el mini mapa apuntando al Golfo de Guinea.
  @IsOptional() @ValidateIf((o) => o.lng !== undefined && o.lng !== null)
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  lat?: number;

  @IsOptional() @ValidateIf((o) => o.lat !== undefined && o.lat !== null)
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  lng?: number;

  @IsOptional() @IsIn(['A', 'P'])
  estado?: string;
}

/** Edición: mismos campos, todos opcionales, sin poder cambiar el id. */
export class UpdatePuestoDto {
  @IsOptional() @IsString() @Length(1, 40)
  nombre?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  departamentoId?: number;

  @IsOptional() @IsString() @MaxLength(100)
  direccion?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  localidadId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  zonaId?: number;

  @IsOptional() @IsEmail({}, { message: 'El email no tiene un formato válido' }) @MaxLength(100)
  mail?: string;

  @IsOptional() @IsString() @MaxLength(20)
  telefono?: string;

  @IsOptional() @IsIn(['S', 'N'])
  propio?: string;

  @IsOptional() @IsIn(['S', 'N'])
  autopedido?: string;

  @IsOptional() @IsIn(['S', 'N'])
  fleteCobra?: string;

  @IsOptional() @IsString() @MaxLength(2)
  fleteCantidad?: string;

  @IsOptional() @IsString() @MaxLength(200)
  horarios?: string;

  @IsOptional() @ValidateIf((o) => o.lng !== undefined && o.lng !== null)
  @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  lat?: number;

  @IsOptional() @ValidateIf((o) => o.lat !== undefined && o.lat !== null)
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  lng?: number;

  @IsOptional() @IsIn(['A', 'P'])
  estado?: string;
}
