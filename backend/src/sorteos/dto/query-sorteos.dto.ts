import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ESTADOS_SORTEO } from './create-sorteo.dto';

export class QuerySorteosDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  pageSize?: number;

  // Búsqueda libre por nombre
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsIn(ESTADOS_SORTEO)
  estado?: string;
}
