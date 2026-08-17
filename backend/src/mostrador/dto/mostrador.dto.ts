import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

// ─────────────────────────── Entrada ────────────────────────────────────────

/** Lo que manda el shell (FichaGoya.exe) para abrir una ficha. */
export class CrearSesionDto {
  @Type(() => Number) @IsInt() @Min(1)
  cliid!: number;

  @IsString() @MinLength(2) @MaxLength(60)
  operador!: string;
}

/**
 * Guardado: solo lo que cambió, con las claves del DTO de la ficha
 * (`nombre`, `direccion.numero`, …), NUNCA columnas del AS400.
 * Se acepta el objeto anidado tal cual lo arma la UI y también las claves
 * "aplanadas" con puntos; el service traduce y valida.
 */
export class GuardarFichaDto {
  @IsObject()
  cambios!: Record<string, unknown>;
}

/** Suggest de calles que consume la UI (proxy a CallesService). */
export class BuscarCallesMostradorDto {
  @IsString() @MinLength(2)
  q!: string;

  @IsOptional() @IsString()
  depto?: string;

  @IsOptional() @IsString()
  ciudad?: string;
}

/** Esquinas + precisión + pin (proxy a EsquinasService). */
export class EsquinasMostradorDto {
  @IsString() @MinLength(2)
  calle!: string;

  @IsOptional() @IsString()
  numero?: string;

  @IsOptional() @IsString()
  depto?: string;

  @IsOptional() @IsString()
  ciudad?: string;
}

// ─────────────────────────── Salida ─────────────────────────────────────────

export interface SesionCreadaDto {
  token: string;
  expiraEn: string;
  cliid: number;
  operador: string;
}

export interface EsquinaFichaDto {
  nombre: string | null;
  calid: number | null;
}

export interface DireccionFichaDto {
  /** Lo que se muestra: OSM si el match está confirmado, si no el nomenclator. */
  calle: string | null;
  calleNomenclator: string | null;
  calid: number | null;
  /** Nombre OSM enlazado al CALID (null si no hay match). */
  osm: string | null;
  /** Precisión del geocoding; en la ficha guardada no se recalcula → null. */
  precision: string | null;
  numero: number | null;
  esquina1: EsquinaFichaDto | null;
  esquina2: EsquinaFichaDto | null;
  lat: number | null;
  lng: number | null;
  utmX: number | null;
  utmY: number | null;
  /** `YYYYMMDD` tal cual lo guarda el AS400. */
  fechaGeo: string | null;
  obsDireccion: string | null;
  avanzados: {
    apto: string;
    blockSolar: string;
    manzana: string;
    km: string;
    nivel: string;
    local: string;
    bis: string;
  };
  ciudad: string | null;
  depto: string | null;
}

export interface TelefonoFichaDto {
  numero: string;
  tipo: string;
  detalle?: string;
}

export interface SenalesFichaDto {
  pedidos12m: number | null;
  historicos: number | null;
  ultPedido: string;
  ultPedidoDetalle: string;
  ultLlamado: string;
  ingreso: string;
  modifico: string;
}

export interface FichaDto {
  cliid: number;
  /** Alias de `cliid`: el tipo `FichaCliente` de la UI usa `id`. */
  id: number;
  nombre: string | null;
  estado: string;
  estadoCodigo: string | null;
  tipo: string | null;
  alta: number | null;
  privilegio: string | null;
  mail: string | null;
  rut: string | null;
  gci: string | null;
  obsCliente: string;
  obs: string;
  obsComercial: string;
  uso: string | null;
  direccion: DireccionFichaDto;
  /** TODO(spec): sin campo AS400 confirmado para envases → siempre null. */
  envases: { k13: number | null; k45: number | null };
  telefonos: TelefonoFichaDto[];
  senales: SenalesFichaDto;
  completitud: { pct: number; faltan: string[] };
  advertencias: string[];
}

export interface GuardarResultadoDto {
  ok: boolean;
  /** Claves del DTO que se escribieron, en el orden en que llegaron. */
  aplicados: string[];
  as400: { afectados: number };
  postgres: { cliente: boolean; clienteUni: boolean; direccion: boolean };
  advertencias: string[];
}
