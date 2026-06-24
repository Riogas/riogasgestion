import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsEmail, IsInt, IsOptional, IsString,
  MaxLength, ValidateNested,
} from 'class-validator';
import { DireccionInputDto } from './direccion-input.dto';
import { TelefonoInputDto } from './telefono-input.dto';

/**
 * Alta de cliente sobre el modelo unificado (ClienteUni) con arrays anidados.
 */
export class CreateClienteDto {
  @IsString() @MaxLength(60)
  nombre: string;

  @IsOptional() @Type(() => Number) @IsInt()
  tipoClienteId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  categoriaPrecioId?: number;

  @IsOptional() @IsString() @MaxLength(12)
  ruc?: string;

  @IsOptional() @IsString() @MaxLength(12)
  cedula?: string;

  @IsOptional() @IsEmail() @MaxLength(60)
  email?: string;

  @IsOptional() @IsString() @MaxLength(1)
  estado?: string;

  @IsOptional() @IsBoolean()
  vip?: boolean;

  @IsOptional() @IsString() @MaxLength(200)
  observaciones?: string;

  @IsOptional() @IsString() @MaxLength(80)
  observacionesComerc?: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => DireccionInputDto) @ArrayMinSize(1)
  direcciones: DireccionInputDto[];

  @IsArray() @ValidateNested({ each: true }) @Type(() => TelefonoInputDto) @ArrayMinSize(1)
  telefonos: TelefonoInputDto[];
}
