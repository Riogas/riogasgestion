import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TipoCliente, EstadoCliente } from '../enums';

export class QueryClientesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsEnum(EstadoCliente)
  estado?: EstadoCliente;

  @IsOptional() @IsEnum(TipoCliente)
  tipoCliente?: TipoCliente;
}
