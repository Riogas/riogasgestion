import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Query de listado de móviles (consulta + filtros). Todo opcional salvo
 * paginación con defaults aplicados en el service.
 */
export class QueryMovilesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number;

  // Búsqueda libre por matrícula / idOriginal / numeroMovil
  @IsOptional() @IsString()
  search?: string;

  // Código de estado del móvil (MOVESTCOD)
  @IsOptional() @Type(() => Number) @IsInt()
  estadoCodigo?: number;

  // tipoServicio / servicioPrincipal
  @IsOptional() @IsString()
  tipoServicio?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  fleteraId?: number;

  // 'si' | 'no' → existe / no existe fila en movil_ica
  @IsOptional() @IsString()
  rutaIca?: string;

  // 'interior' | 'capital'
  @IsOptional() @IsString()
  origen?: string;

  // Por defecto la lista trae SOLO móviles activos (estado que empieza con
  // "ACTIVO"). Enviar 'false' para traer todos. Se ignora si se filtra por
  // un estadoCodigo explícito.
  @IsOptional() @IsString()
  soloActivos?: string;

  // 'movil' | '-movil'
  @IsOptional() @IsString()
  sort?: string;
}
