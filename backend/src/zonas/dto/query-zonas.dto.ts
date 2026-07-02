import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { SERVICIOS_ZONA, TIPOS_ZONA } from './create-zona.dto';

export class QueryZonasDto {
  @Type(() => Number) @IsInt()
  puestoId!: number;

  @IsOptional() @IsIn(TIPOS_ZONA)
  tipoZona?: string;

  @IsOptional() @IsIn(SERVICIOS_ZONA)
  servicio?: string;

  @IsOptional() @IsString()
  search?: string;

  // 'false' → solo ACTIVE. Default: trae todas (el front filtra por capas).
  @IsOptional() @IsString()
  incluirArchivadas?: string;
}
