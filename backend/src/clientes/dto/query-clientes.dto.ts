import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryClientesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number;

  // Búsqueda libre por nombre / email / ruc
  @IsOptional() @IsString()
  search?: string;

  // Código de estado (CHAR(1) en origen)
  @IsOptional() @IsString()
  estado?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  zona?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  tipoId?: number;
}
