import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * Query del listado de puestos. Todo opcional; los defaults de paginación se
 * aplican en el service.
 */
export class QueryPuestosDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number;

  /** Búsqueda libre: nombre, dirección, departamento o id. */
  @IsOptional() @IsString()
  search?: string;

  /** Estado del puesto: A=Activo / P=Pasivo. */
  @IsOptional() @IsString()
  estado?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  departamentoId?: number;

  /** con | sin — según tenga zonas operativas asignadas. */
  @IsOptional() @IsIn(['con', 'sin'])
  conZona?: string;

  /** con | sin — según tenga móviles asociados. */
  @IsOptional() @IsIn(['con', 'sin'])
  conMoviles?: string;
}
