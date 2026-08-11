import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class BuscarCallesDto {
  @IsString() @MinLength(2)
  q!: string;

  @IsOptional() @IsString()
  depto?: string;

  @IsOptional() @IsString()
  ciudad?: string;

  // 'texto' devuelve líneas pipe-delimited para que el VB6 parsee con Split().
  @IsOptional() @IsIn(['json', 'texto'])
  formato?: string;
}

export class EsquinasDto {
  @IsString() @MinLength(2)
  calle!: string;

  @IsOptional() @IsString()
  numero?: string;

  @IsOptional() @IsString()
  depto?: string;

  @IsOptional() @IsString()
  ciudad?: string;

  @IsOptional() @IsIn(['json', 'texto'])
  formato?: string;
}

export class ResolverDto {
  @IsString() @MinLength(2)
  nombreOsm!: string;

  @IsOptional() @IsString()
  depto?: string;

  @IsOptional() @IsString()
  localidad?: string;
}

export class ListarMatchesDto {
  @IsOptional() @IsIn(['AUTO_CONFIRMADO', 'A_REVISAR', 'RECHAZADO', 'CONFIRMADO_MANUAL'])
  estado?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  take?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  skip?: number;
}

export class RevisarMatchDto {
  @IsIn(['aprobar', 'rechazar', 'corregir'])
  accion!: 'aprobar' | 'rechazar' | 'corregir';

  @IsString() @MinLength(2)
  usuario!: string;

  @IsOptional() @Type(() => Number) @IsInt()
  calleOsmId?: number;
}
