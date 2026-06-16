import { Type } from 'class-transformer';
import {
  IsArray, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator';
import { TipoCliente, CategoriaCliente, EstadoCliente } from '../enums';
import { CreateTelefonoDto } from './create-telefono.dto';
import { CreateDireccionDto } from './create-direccion.dto';

export class CreateClienteDto {
  @IsOptional() @IsInt()
  nroCliente?: number;

  @IsString() @MaxLength(120)
  nombre: string;

  @IsOptional() @IsString() @MaxLength(120)
  apellido?: string;

  @IsOptional() @IsEnum(TipoCliente)
  tipoCliente?: TipoCliente;

  @IsOptional() @IsEnum(CategoriaCliente)
  categoria?: CategoriaCliente;

  @IsOptional() @IsString() @MaxLength(32)
  rutCi?: string;

  @IsOptional() @IsString() @MaxLength(32)
  gci?: string;

  @IsOptional() @IsEmail() @MaxLength(160)
  email?: string;

  @IsOptional() @IsString() @MaxLength(60)
  privilegio?: string;

  @IsOptional() @IsString()
  obsCliente?: string;

  @IsOptional() @IsString()
  obsGeneral?: string;

  @IsOptional() @IsString()
  obsComercial?: string;

  @IsOptional() @IsEnum(EstadoCliente)
  estado?: EstadoCliente;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateTelefonoDto)
  telefonos?: CreateTelefonoDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateDireccionDto)
  direcciones?: CreateDireccionDto[];
}
