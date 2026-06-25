import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Query de listado de empresas fleteras (consulta + filtros). Todo opcional
 * salvo paginación con defaults aplicados en el service.
 */
export class QueryFleterasDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number;

  // Búsqueda libre por nombre (contains insensitive)
  @IsOptional() @IsString()
  search?: string;

  // Estado de la empresa: A=Activo / P=Pasivo / I=Inactivo
  @IsOptional() @IsString()
  estado?: string;

  // Puesto al que pertenece la empresa
  @IsOptional() @Type(() => Number) @IsInt()
  puestoId?: number;

  // Filtro por móviles: con-activos | sin-activos | sin
  @IsOptional() @IsIn(['con-activos', 'sin-activos', 'sin'])
  conMoviles?: string;
}
