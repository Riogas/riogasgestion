import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryClientesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number;

  // Búsqueda libre por nombre / email / ruc / cédula
  @IsOptional() @IsString()
  search?: string;

  // Código de estado (CHAR(1) en origen)
  @IsOptional() @IsString()
  estado?: string;

  // 'interior' | 'capital'
  @IsOptional() @IsString()
  origen?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  tipoClienteId?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  dedupRevisar?: boolean;
}
