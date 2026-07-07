import { Type } from 'class-transformer';
import {
  IsInt, IsNumber, IsOptional, IsString, Min,
} from 'class-validator';

export class QuerySugerenciasDto {
  @IsOptional() @IsString()
  tipo?: string;

  @IsOptional() @IsString()
  estado?: string;

  @IsOptional() @Type(() => Number) @IsNumber()
  minConfianza?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number;
}
