import { Type } from 'class-transformer';
import {
  IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength,
} from 'class-validator';

/**
 * Dirección anidada en el alta de cliente (ClienteDireccion).
 */
export class DireccionInputDto {
  @IsOptional() @IsString() @MaxLength(150)
  calle?: string;

  @IsOptional() @IsString() @MaxLength(40)
  nro?: string;

  @IsOptional() @IsString() @MaxLength(150)
  esquina1?: string;

  @IsOptional() @IsString() @MaxLength(150)
  esquina2?: string;

  @IsOptional() @IsString() @MaxLength(40)
  apto?: string;

  @IsOptional() @IsString() @MaxLength(40)
  local?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  departamentoId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  localidadId?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  lat?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  lng?: number;

  @IsOptional() @IsString() @MaxLength(300)
  direccion?: string;

  @IsBoolean()
  principal: boolean;

  @IsOptional() @IsString() @MaxLength(1)
  estado?: string;
}
