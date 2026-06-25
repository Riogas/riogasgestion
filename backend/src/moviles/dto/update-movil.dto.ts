import { Type } from 'class-transformer';
import {
  IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength,
} from 'class-validator';

/**
 * Update parcial de la cabecera del móvil (secciones 1-3 de la pantalla de
 * detalle: datos generales + ruteo/comportamiento + operación en app).
 * Todo opcional. Los sub-dominios (productos/puntos/servicios/escenarios) se
 * editan por sub-recurso.
 */
export class UpdateMovilDto {
  // ── Sección 1: datos generales ──────────────────────────────────────────────
  @IsOptional() @IsString() @MaxLength(40)
  descripcion?: string;

  @IsOptional() @IsString() @MaxLength(10)
  matricula?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  fleteraId?: number;

  @IsOptional() @IsString() @MaxLength(30)
  marca?: string;

  @IsOptional() @IsString() @MaxLength(30)
  modelo?: string;

  @IsOptional() @IsString() @MaxLength(30)
  tipoServicio?: string;

  @IsOptional() @IsString() @MaxLength(30)
  servicioPrincipal?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  capacidadLote?: number;

  @IsOptional() @IsString() @MaxLength(60)
  observaciones?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  estadoCodigo?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  pedidosPendientes?: number;

  @IsOptional() @IsString() @MaxLength(30)
  telefono?: string;

  @IsOptional() @IsString() @MaxLength(60)
  dirSms?: string;

  // ISO date (YYYY-MM-DD) → DateTime @db.Date
  @IsOptional() @IsString()
  activoDesde?: string;

  @IsOptional() @IsString()
  activoHasta?: string;

  // ── Sección 2: ruteo y comportamiento ──────────────────────────────────────
  @IsOptional() @IsBoolean()
  rutea?: boolean;

  @IsOptional() @IsBoolean()
  enviarPedidosCelular?: boolean;

  @IsOptional() @IsBoolean()
  actualizarCoord30s?: boolean;

  @IsOptional() @IsBoolean()
  usaIca?: boolean;

  @IsOptional() @IsBoolean()
  mostrarEnMapa?: boolean;

  @IsOptional() @IsString() @MaxLength(2)
  reasignacionPuesto?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  activarDireccionCalleId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  activarDireccionNro?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  coordActivaX?: number;

  @IsOptional() @Type(() => Number) @IsNumber()
  coordActivaY?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  tiempoCumplimientoServicio?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  finalizacionRutas1?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  finalizacionRutas2?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  radioMinIcaMetros?: number;

  // ── Sección 3: operación en app ─────────────────────────────────────────────
  @IsOptional() @IsBoolean()
  activarPorApp?: boolean;

  @IsOptional() @IsBoolean()
  appPuedeDesactivar?: boolean;

  @IsOptional() @IsBoolean()
  capturaPantalla?: boolean;

  @IsOptional() @IsBoolean()
  grabarPantalla?: boolean;

  @IsOptional() @IsBoolean()
  debugDelivery?: boolean;

  @IsOptional() @IsBoolean()
  permiteBajaMomentanea?: boolean;

  @IsOptional() @Type(() => Number) @IsInt()
  distanciaMaxMetros?: number;
}
