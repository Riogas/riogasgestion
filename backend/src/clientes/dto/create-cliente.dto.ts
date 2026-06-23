import { Type } from 'class-transformer';
import {
  IsBoolean, IsDate, IsInt, IsOptional, IsString, MaxLength,
} from 'class-validator';

/**
 * Cliente plano — espejo de GXCALDTA.CLIENTE (sin campos AUX).
 * `id` es el CLIID original del AS400 (no autogenerado).
 */
export class CreateClienteDto {
  @IsInt()
  id: number;

  @IsOptional() @IsString() @MaxLength(60)
  nombre?: string;

  @IsOptional() @IsString() @MaxLength(12)
  ruc?: string;

  @IsOptional() @IsString() @MaxLength(200)
  observaciones?: string;

  @IsOptional() @IsString() @MaxLength(60)
  email?: string;

  @IsOptional() @IsString() @MaxLength(1)
  estado?: string;

  @IsOptional() @IsString() @MaxLength(6)
  nroGci?: string;

  @IsOptional() @IsBoolean()
  vip?: boolean;

  @IsOptional() @IsString() @MaxLength(80)
  observacionesComerciales?: string;

  @IsOptional() @Type(() => Date) @IsDate()
  fechaAlta?: Date;

  @IsOptional() @Type(() => Date) @IsDate()
  fecha?: Date;

  @IsOptional() @Type(() => Date) @IsDate()
  fechaGeolocalizacion?: Date;

  @IsOptional() @Type(() => Date) @IsDate()
  fechaUltimaLlamada?: Date;

  // Dirección
  @IsOptional() @Type(() => Number) @IsInt()
  numeroPuerta?: number;

  @IsOptional() @IsString() @MaxLength(1)
  bis?: string;

  @IsOptional() @IsString() @MaxLength(5)
  apartamento?: string;

  @IsOptional() @IsString() @MaxLength(4)
  blockSolar?: string;

  @IsOptional() @IsString() @MaxLength(4)
  nivel?: string;

  @IsOptional() @IsString() @MaxLength(4)
  local?: string;

  @IsOptional() @IsString() @MaxLength(5)
  numeroManzana?: string;

  @IsOptional()
  km?: string | number;

  @IsOptional() @IsString() @MaxLength(60)
  observacionesDireccion?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  calleEsquina1Id?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  calleEsquina2Id?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  callePrincipalId?: number;

  // Geo
  @IsOptional() coordenadaX?: string | number;
  @IsOptional() coordenadaY?: string | number;
  @IsOptional() sadCoordenadaX?: string | number;
  @IsOptional() sadCoordenadaY?: string | number;

  @IsOptional() @IsString() @MaxLength(1)
  sadAsignadoMovil?: string;

  @IsOptional() icaCoordenadaX?: string | number;
  @IsOptional() icaCoordenadaY?: string | number;

  @IsOptional() @Type(() => Number) @IsInt()
  icaMetodo?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  icaSourceId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  icaSourceCodigo?: number;

  @IsOptional() icaPosA?: string | number;

  @IsOptional() @Type(() => Number) @IsInt()
  icaSofDg?: number;

  // Clasificación / referencias
  @IsOptional() @Type(() => Number) @IsInt()
  tipoId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  zona?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  radio?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  ultimoPedidoId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  tipoServicioId?: number;

  @IsOptional() @IsString() @MaxLength(15)
  operadorAlta?: string;

  @IsOptional() @IsString() @MaxLength(15)
  operadorModificacion?: string;
}
