import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { busquedaNorm } from '../common/direccion/normalize-direccion';
import { As400Client, ClienteAs400, ValorAs400 } from './as400.client';
import { esCoordenadaUruguaya, latLngAUtm21S } from './geo';
import {
  DireccionFichaDto,
  FichaDto,
  GuardarResultadoDto,
  SenalesFichaDto,
  TelefonoFichaDto,
} from './dto/mostrador.dto';

/**
 * El orquestador de la ficha de mostrador.
 *
 * Lee del AS400 (fuente de verdad de la app VB6), enriquece con el puente
 * nomenclator↔OSM de goya y, al guardar, escribe en un orden INVIOLABLE:
 *   validar → AS400 → Postgres → auditar.
 * Si el AS400 falla no se toca Postgres (502). Si falla Postgres, el AS400 ya
 * quedó bien y se responde 207 con el detalle: nunca se miente al operador.
 */

/** Estados de `calle_match` que habilitan mostrar el nombre OSM como oficial. */
const ESTADOS_MATCH_CONFIRMADO = ['AUTO_CONFIRMADO', 'CONFIRMADO_MANUAL'];
/** La ficha de mostrador es de capital (GXCALDTA); el interior va por PUESTOS. */
const ORIGEN_CAPITAL = 'capital';
/** Procedencia del pin: queda en goya porque ICAMET no se escribe (decisión de la spec). */
const GEO_FUENTE = 'goya-osm';
const ORIGEN_AUDITORIA = 'ficha-mostrador';
/**
 * 207 Multi-Status: el AS400 guardó, Postgres no. No existe en HttpStatus de Nest.
 * Ojo al consumir: el AllExceptionsFilter global envuelve el cuerpo de toda
 * HttpException, así que el detalle le llega a la UI en
 * `{statusCode, timestamp, path, method, message:{ok:false, etapa, …}}`.
 */
const HTTP_MULTI_STATUS = 207;

const ADVERTENCIA_COORDENADAS =
  'Las coordenadas guardadas no corresponden a Uruguay — verificá el pin antes de guardar';

/**
 * GXCALDTA viene de GeneXus: los campos vacíos ahí son `''` y `0`, no NULL
 * (el propio GET del contrato A devuelve `0` para "sin dato"). Este módulo
 * nunca le manda NULL al AS400 para no arriesgar una columna NOT NULL del
 * sistema viejo; en Postgres, en cambio, el vacío se guarda como NULL de verdad.
 */
const VACIO_NUMERICO = 0;
const VACIO_TEXTO = '';

type TipoCampo = 'char' | 'int' | 'dec';

/** Lo que el operador puede tocar, ya normalizado y listo para repartir. */
interface CambiosNormalizados {
  nombre?: string | null;
  mail?: string | null;
  /** Numérico: el AS400 lo guarda en un DECIMAL(12,0); a Postgres va como texto. */
  rut?: number | null;
  obsCliente?: string | null;
  obsComercial?: string | null;
  calid?: number | null;
  calleNombre?: string | null;
  numero?: number | null;
  esq1Id?: number | null;
  esq1Nombre?: string | null;
  esq2Id?: number | null;
  esq2Nombre?: string | null;
  lat?: number | null;
  lng?: number | null;
  utmX?: number | null;
  utmY?: number | null;
  fechaGeo?: string | null;
  obsDireccion?: string | null;
  apto?: string | null;
  blockSolar?: string | null;
  manzana?: string | null;
  km?: number | null;
  nivel?: string | null;
  local?: string | null;
  bis?: string | null;
}

interface DefinicionCampo {
  /** Columna de GXCALDTA.CLIENTE. `null` = el dato solo viaja a Postgres. */
  columna: string | null;
  clave: keyof CambiosNormalizados;
  tipo: TipoCampo;
  /** char: largo máximo. */
  largo?: number;
  /** int: valor máximo (el mínimo siempre es 0). */
  maximo?: number;
  /** dec: precisión y escala de la columna DB2. */
  precision?: number;
  escala?: number;
  etiqueta: string;
}

/** Resultado de validar un valor: o sirve, o hay un error para mostrarle al operador. */
type Normalizacion = { ok: true; valor: string | number | null } | { ok: false; error: string };

/** Lo que goya le agrega al dato crudo del AS400. */
interface ContextoFicha {
  calleNomenclator: string | null;
  calleOsm: string | null;
  calleMostrar: string | null;
  esquinas: Map<number, string | null>;
  tipo: string | null;
  ciudad: string | null;
  depto: string | null;
  uso: string | null;
}

/** Sin base de goya, la ficha se abre igual con lo que dio el AS400. */
function contextoVacio(): ContextoFicha {
  return {
    calleNomenclator: null,
    calleOsm: null,
    calleMostrar: null,
    esquinas: new Map(),
    tipo: null,
    ciudad: null,
    depto: null,
    uso: null,
  };
}

/**
 * Mapeo DTO → AS400 (tabla maestra de la spec, punto 5). Las claves son las
 * del DTO que consume la UI, aplanadas con puntos. Todo lo que no esté acá
 * se rechaza con error explícito: nada se ignora en silencio.
 */
const CAMPOS_DTO: Record<string, DefinicionCampo> = {
  nombre: { columna: 'CLINOM', clave: 'nombre', tipo: 'char', largo: 60, etiqueta: 'el nombre' },
  mail: { columna: 'CLIMAIL', clave: 'mail', tipo: 'char', largo: 60, etiqueta: 'el mail' },
  // CLIRUC es DECIMAL(12,0) en el AS400: se valida como entero para que un RUT
  // con puntos o guiones se rechace acá, con un mensaje claro, y no en el driver.
  rut: { columna: 'CLIRUC', clave: 'rut', tipo: 'int', maximo: 999999999999, etiqueta: 'el RUT' },
  obsCliente: {
    columna: 'CLIOBS',
    clave: 'obsCliente',
    tipo: 'char',
    largo: 200,
    etiqueta: 'las observaciones del cliente',
  },
  obsComercial: {
    columna: 'CLIOBSCOM',
    clave: 'obsComercial',
    tipo: 'char',
    largo: 80,
    etiqueta: 'las observaciones comerciales',
  },
  'direccion.calid': {
    columna: 'CALPRINID',
    clave: 'calid',
    tipo: 'int',
    maximo: 999999,
    etiqueta: 'la calle',
  },
  'direccion.calle': {
    columna: null,
    clave: 'calleNombre',
    tipo: 'char',
    largo: 150,
    etiqueta: 'el nombre de la calle',
  },
  'direccion.numero': {
    columna: 'NROPUERTA',
    clave: 'numero',
    tipo: 'int',
    maximo: 99999,
    etiqueta: 'el número de puerta',
  },
  'direccion.esquina1.calid': {
    columna: 'CALESQ1ID',
    clave: 'esq1Id',
    tipo: 'int',
    maximo: 999999,
    etiqueta: 'la esquina 1',
  },
  'direccion.esquina1.nombre': {
    columna: null,
    clave: 'esq1Nombre',
    tipo: 'char',
    largo: 150,
    etiqueta: 'el nombre de la esquina 1',
  },
  'direccion.esquina2.calid': {
    columna: 'CALESQ2ID',
    clave: 'esq2Id',
    tipo: 'int',
    maximo: 999999,
    etiqueta: 'la esquina 2',
  },
  'direccion.esquina2.nombre': {
    columna: null,
    clave: 'esq2Nombre',
    tipo: 'char',
    largo: 150,
    etiqueta: 'el nombre de la esquina 2',
  },
  // DIRCORX es la LATITUD y DIRCORY la LONGITUD: los nombres están invertidos
  // en el AS400 (hecho verificado, no "arreglar").
  'direccion.lat': {
    columna: 'DIRCORX',
    clave: 'lat',
    tipo: 'dec',
    precision: 13,
    escala: 5,
    etiqueta: 'la latitud',
  },
  'direccion.lng': {
    columna: 'DIRCORY',
    clave: 'lng',
    tipo: 'dec',
    precision: 13,
    escala: 5,
    etiqueta: 'la longitud',
  },
  'direccion.obsDireccion': {
    columna: 'DIROBS',
    clave: 'obsDireccion',
    tipo: 'char',
    largo: 60,
    etiqueta: 'las observaciones de la dirección',
  },
  'direccion.avanzados.apto': {
    columna: 'APTO',
    clave: 'apto',
    tipo: 'char',
    largo: 5,
    etiqueta: 'el apartamento',
  },
  'direccion.avanzados.blockSolar': {
    columna: 'BLOCKSOL',
    clave: 'blockSolar',
    tipo: 'char',
    largo: 4,
    etiqueta: 'el block/solar',
  },
  'direccion.avanzados.manzana': {
    columna: 'NROMANZ',
    clave: 'manzana',
    tipo: 'char',
    largo: 5,
    etiqueta: 'la manzana',
  },
  'direccion.avanzados.km': {
    columna: 'KM',
    clave: 'km',
    tipo: 'dec',
    precision: 6,
    escala: 3,
    etiqueta: 'el kilómetro',
  },
  'direccion.avanzados.nivel': {
    columna: 'NIVEL',
    clave: 'nivel',
    tipo: 'char',
    largo: 4,
    etiqueta: 'el nivel',
  },
  'direccion.avanzados.local': {
    columna: 'LOCAL',
    clave: 'local',
    tipo: 'char',
    largo: 4,
    etiqueta: 'el local',
  },
  'direccion.avanzados.bis': {
    columna: 'BIS',
    clave: 'bis',
    tipo: 'char',
    largo: 1,
    etiqueta: 'el bis',
  },
};

// ─────────────────────────── Helpers de formato ─────────────────────────────

/** El vacío del DTO (`null`) traducido a la convención de GXCALDTA. */
function valorParaAs400(def: DefinicionCampo, valor: string | number | null): ValorAs400 {
  if (valor !== null) return valor;
  return def.tipo === 'char' ? VACIO_TEXTO : VACIO_NUMERICO;
}

/** Hoy en el formato del AS400 (`YYYYMMDD`), en hora local del server. */
function hoyAs400(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}${mes}${dia}`;
}

/** `YYYYMMDD` → Date (medianoche UTC, que es como Prisma guarda los @db.Date). */
function fechaAs400ADate(valor: string | null | undefined): Date | null {
  if (!valor || !/^\d{8}$/.test(valor)) return null;
  const anio = Number(valor.slice(0, 4));
  const mes = Number(valor.slice(4, 6));
  const dia = Number(valor.slice(6, 8));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return new Date(Date.UTC(anio, mes - 1, dia));
}

/** 4390 → "4.390" (sin depender de ICU). */
function conMiles(valor: number): string {
  return String(Math.round(valor)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** '2026-08-10' → '10/08'. */
function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}` : '';
}

/** '2026-08-14T16:41:00' → 'hoy 16:41' o '14/08 16:41'. */
function momentoCorto(iso: string | null | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return '';
  const hoy = hoyAs400();
  const esHoy = `${m[1]}${m[2]}${m[3]}` === hoy;
  return esHoy ? `hoy ${m[4]}:${m[5]}` : `${m[3]}/${m[2]} ${m[4]}:${m[5]}`;
}

function textoODefecto(valor: string | null | undefined): string {
  return (valor ?? '').trim();
}

/**
 * En GXCALDTA el "sin dato" de un id/número es `0` (así lo devuelve el contrato
 * A). En la ficha eso es `null`: un CALID 0 no existe y una puerta 0 no se
 * muestra.
 */
function idONull(valor: number | null | undefined): number | null {
  return typeof valor === 'number' && valor > 0 ? valor : null;
}

/**
 * Espejo en TS de `construir_direccion` (backend/prisma/reimport_clientes.py y
 * backfill_geo.py). El formato TIENE que ser el mismo: `cliente.direccion` y
 * `cliente_direccion.direccion` son lo que muestra y busca el panel, y una vez
 * que esta ficha estampa `editadoPanelAt`, `sync_cliente_uni.py` no vuelve a
 * refrescar la fila nunca más. Si no se reconstruye acá, queda vieja para siempre.
 */
function construirDireccion(p: {
  calle: string | null;
  nro: string | null;
  bis: string | null;
  esq1: string | null;
  esq2: string | null;
  solar: string | null;
  mz: string | null;
  apto: string | null;
  km: string | null;
  localidad: string | null;
}): string | null {
  const partes: string[] = [];
  let base = (p.calle ?? '').trim();
  if (p.nro) base = `${base} ${p.nro}`.trim();
  if (p.bis) base = `${base} ${p.bis}`.trim();
  if (base) partes.push(base);
  const esquinas = [p.esq1, p.esq2].filter((e): e is string => !!e);
  if (esquinas.length > 0) partes.push(`esq. ${esquinas.join(' y ')}`);
  if (p.solar) partes.push(`Solar ${p.solar}`);
  if (p.mz) partes.push(`Mz ${p.mz}`);
  if (p.apto) partes.push(`Apto ${p.apto}`);
  if (p.km) partes.push(`Km ${p.km}`);
  if (p.localidad) partes.push(p.localidad);
  return partes.join(', ').slice(0, 300) || null;
}

/** Saca un mensaje legible de cualquier error, sin perder el detalle del backend. */
function mensajeDeError(e: unknown): string {
  if (e instanceof HttpException) {
    const cuerpo = e.getResponse();
    if (typeof cuerpo === 'string') return cuerpo;
    const obj = cuerpo as { message?: unknown; error?: unknown };
    if (typeof obj.message === 'string') return obj.message;
    if (Array.isArray(obj.message)) return obj.message.join('; ');
    if (typeof obj.error === 'string') return obj.error;
  }
  return e instanceof Error ? e.message : String(e);
}

/** Aplana `{direccion:{numero:1}}` → `{'direccion.numero': 1}`. */
function aplanar(
  objeto: Record<string, unknown>,
  prefijo = '',
  // Sin prototipo: si el payload trae `__proto__`, tiene que quedar como una
  // clave más (y morir en la lista blanca), no cambiarle el prototipo al objeto.
  salida: Record<string, unknown> = Object.create(null) as Record<string, unknown>,
): Record<string, unknown> {
  for (const [clave, valor] of Object.entries(objeto)) {
    const ruta = prefijo ? `${prefijo}.${clave}` : clave;
    const esObjetoPlano =
      valor !== null &&
      typeof valor === 'object' &&
      !Array.isArray(valor) &&
      Object.getPrototypeOf(valor) === Object.prototype;
    if (esObjetoPlano) {
      aplanar(valor as Record<string, unknown>, ruta, salida);
    } else {
      salida[ruta] = valor;
    }
  }
  return salida;
}

@Injectable()
export class MostradorService {
  private readonly logger = new Logger(MostradorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly as400: As400Client,
  ) {}

  // ─────────────────────────── Lectura ──────────────────────────────────────

  /** La ficha completa: AS400 + enriquecimiento OSM + señales + advertencias. */
  async ficha(cliid: number): Promise<FichaDto> {
    const advertencias: string[] = [];

    // El cliente es obligatorio; señales y teléfonos son accesorios: si el
    // AS400 no los da, la ficha igual se abre (con aviso) en vez de romperse.
    const cli = await this.as400.cliente(cliid);
    const [senales, telefonos] = await Promise.all([
      this.as400.senales(cliid).catch((e) => {
        this.logger.warn(`Señales del cliente ${cliid}: ${mensajeDeError(e)}`);
        advertencias.push('No se pudieron traer los pedidos del cliente');
        return null;
      }),
      this.as400.telefonos(cliid).catch((e) => {
        this.logger.warn(`Teléfonos del cliente ${cliid}: ${mensajeDeError(e)}`);
        advertencias.push('No se pudieron traer los teléfonos del cliente');
        return null;
      }),
    ]);

    // El enriquecimiento sale de Postgres. Si goya está caído, la ficha se abre
    // igual con el dato crudo del AS400 y avisa: el mostrador no puede quedarse
    // sin atender por una base que solo agrega nombres.
    const ctx = await this.contexto(cli, cliid).catch((e) => {
      this.logger.error(`Enriquecimiento de goya del cliente ${cliid}: ${mensajeDeError(e)}`);
      advertencias.push(
        'No se pudo leer la base de goya: faltan el nombre de la calle, la ciudad y el departamento',
      );
      return contextoVacio();
    });
    const d = cli.direccion;

    if (d.lat !== null && d.lng !== null && !esCoordenadaUruguaya(d.lat, d.lng)) {
      advertencias.push(ADVERTENCIA_COORDENADAS);
    }

    const direccion: DireccionFichaDto = {
      calle: ctx.calleMostrar,
      calleNomenclator: ctx.calleNomenclator,
      calid: idONull(d.calprinid),
      osm: ctx.calleOsm,
      // La precisión se calcula al geocodificar (/api/mostrador/esquinas); lo
      // guardado en el AS400 no la tiene, así que no se inventa.
      precision: null,
      numero: idONull(d.nroPuerta),
      esquina1: d.esq1Id ? { nombre: ctx.esquinas.get(d.esq1Id) ?? null, calid: d.esq1Id } : null,
      esquina2: d.esq2Id ? { nombre: ctx.esquinas.get(d.esq2Id) ?? null, calid: d.esq2Id } : null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      utmX: d.utmX ?? null,
      utmY: d.utmY ?? null,
      fechaGeo: d.fechaGeo ?? null,
      obsDireccion: textoODefecto(d.dirObs),
      avanzados: {
        apto: textoODefecto(d.apto),
        blockSolar: textoODefecto(d.blockSolar),
        manzana: textoODefecto(d.nroManzana),
        km: d.km !== null && d.km !== undefined && d.km !== 0 ? String(d.km) : '',
        nivel: textoODefecto(d.nivel),
        local: textoODefecto(d.local),
        bis: textoODefecto(d.bis),
      },
      ciudad: ctx.ciudad,
      depto: ctx.depto,
    };

    const senalesDto: SenalesFichaDto = {
      pedidos12m: senales ? senales.pedidos12m : null,
      historicos: senales ? senales.pedidosHist : null,
      ultPedido: fechaCorta(senales?.ultPedido?.fecha),
      // TODO(spec): PRODPRCOD → descripción ("13 kg") no está mapeado en ningún
      // lado que conozcamos, así que se muestra cantidad + importe.
      ultPedidoDetalle: senales?.ultPedido
        ? [
            senales.ultPedido.cantidad ? `${senales.ultPedido.cantidad} u` : '',
            senales.ultPedido.importe ? `$ ${conMiles(senales.ultPedido.importe)}` : '',
          ]
            .filter(Boolean)
            .join(' · ')
        : '',
      ultLlamado: momentoCorto(cli.ultimaLlamada),
      ingreso: textoODefecto(cli.operadorAlta),
      modifico: textoODefecto(cli.operadorModificacion),
    };

    // TELCLI acumula todo el historial de números del cliente: hay fichas con más
    // de veinte, casi todos dados de baja (estado distinto de 'A'). Al operador le
    // sirven los vigentes; si ninguno quedó vigente se muestran todos, para no
    // dejar la tarjeta vacía cuando el dato existe.
    const telefonosVigentes = (telefonos ?? []).filter((t) => (t?.estado ?? '').trim() === 'A');
    const telefonosAMostrar = telefonosVigentes.length > 0 ? telefonosVigentes : (telefonos ?? []);

    const telefonosDto: TelefonoFichaDto[] = telefonosAMostrar.map((t) => {
      // El número llega como string (los ceros a la izquierda importan), pero
      // no se confía: un número suelto en el JSON no puede romper la ficha.
      const numero = String(t?.numero ?? '').trim();
      return {
        numero,
        // El AS400 no distingue fijo/celular: se deduce del número (09x = celular).
        tipo: /^0?9\d/.test(numero.replace(/\D/g, '')) ? 'cel' : 'fijo',
        detalle: textoODefecto(t?.obs) || undefined,
      };
    });

    const completitud = this.completitud(cli);

    return {
      cliid: cli.cliid,
      id: cli.cliid,
      nombre: cli.nombre,
      estado: cli.estado === 'A' ? 'Activo' : 'Inactivo',
      estadoCodigo: cli.estado,
      tipo: ctx.tipo,
      alta: cli.fechaAlta && /^\d{8}$/.test(cli.fechaAlta) ? Number(cli.fechaAlta.slice(0, 4)) : null,
      privilegio: cli.vip ? 'VIP' : null,
      mail: cli.email,
      rut: cli.ruc,
      gci: cli.gci,
      obsCliente: textoODefecto(cli.obs),
      obs: textoODefecto(d.dirObs),
      obsComercial: textoODefecto(cli.obsComercial),
      uso: ctx.uso,
      direccion,
      // TODO(spec): no hay campo AS400 confirmado para envases en poder del
      // cliente → null y no se escribe (decisión de la spec, punto 4).
      envases: { k13: null, k45: null },
      telefonos: telefonosDto,
      senales: senalesDto,
      completitud,
      advertencias,
    };
  }

  /** Lo que goya le puede agregar al dato crudo del AS400. */
  private async contexto(cli: ClienteAs400, cliid: number): Promise<ContextoFicha> {
    const calid = idONull(cli.direccion.calprinid);
    const idsEsquinas = [cli.direccion.esq1Id, cli.direccion.esq2Id].filter(
      (v): v is number => typeof v === 'number' && v > 0,
    );

    const [calle, esquinas, tipo, matches, uni] = await Promise.all([
      calid ? this.prisma.calle.findUnique({ where: { id: calid } }) : Promise.resolve(null),
      idsEsquinas.length
        ? this.prisma.calle.findMany({
            where: { id: { in: idsEsquinas } },
            select: { id: true, nombre: true },
          })
        : Promise.resolve([] as { id: number; nombre: string | null }[]),
      cli.tipoId
        ? this.prisma.tipoCliente.findUnique({ where: { id: cli.tipoId } })
        : Promise.resolve(null),
      // Se traen TODOS los matches del CALID, no solo los confirmados: la UI
      // muestra el nombre OSM aunque el match esté a revisar (campo `osm`), y
      // solo lo usa como nombre oficial (`calle`) cuando está confirmado.
      calid
        ? this.prisma.calleMatch.findMany({
            where: { calleId: calid, estado: { not: 'RECHAZADO' } },
            orderBy: [{ score: 'desc' }, { id: 'asc' }],
            take: 10,
            select: { calleOsmId: true, estado: true },
          })
        : Promise.resolve([] as { calleOsmId: number; estado: string }[]),
      this.prisma.clienteUni.findFirst({
        where: { origen: ORIGEN_CAPITAL, idOriginal: cliid },
        orderBy: { id: 'asc' },
        select: { id: true },
      }),
    ]);

    const confirmado = matches.find((m) => ESTADOS_MATCH_CONFIRMADO.includes(m.estado)) ?? null;
    const match = confirmado ?? matches[0] ?? null;

    const [osm, ciudad, direccionPg] = await Promise.all([
      match
        ? this.prisma.calleOsm.findUnique({
            where: { id: match.calleOsmId },
            select: { nombre: true },
          })
        : Promise.resolve(null),
      calle?.ciudadId
        ? this.prisma.ciudadNomenclator.findUnique({ where: { id: calle.ciudadId } })
        : Promise.resolve(null),
      uni
        ? this.prisma.clienteDireccion.findFirst({
            where: { clienteId: uni.id },
            orderBy: [{ principal: 'desc' }, { id: 'asc' }],
            select: { usoGarrafa: true },
          })
        : Promise.resolve(null),
    ]);

    const deptoId = ciudad?.deptoId ?? calle?.deptoId ?? null;
    const depto = deptoId
      ? await this.prisma.deptoNomenclator.findUnique({ where: { id: deptoId } })
      : null;

    return {
      calleNomenclator: calle?.nombre ?? null,
      calleOsm: osm?.nombre ?? null,
      // Con match confirmado manda el nombre OSM; si no, el del nomenclator
      // (y recién si el nomenclator no tiene nada, lo que haya de OSM).
      calleMostrar: (confirmado ? osm?.nombre : null) ?? calle?.nombre ?? osm?.nombre ?? null,
      esquinas: new Map<number, string | null>(
        esquinas.map((e): [number, string | null] => [e.id, e.nombre]),
      ),
      tipo: tipo?.descripcion ?? null,
      ciudad: ciudad?.nombre ?? null,
      depto: depto?.nombre ?? null,
      uso: direccionPg?.usoGarrafa ?? null,
    };
  }

  /** Qué le falta a la ficha para estar completa (spec: mail, rut, geo, esquinas, obs). */
  private completitud(cli: ClienteAs400): { pct: number; faltan: string[] } {
    const d = cli.direccion;
    const items: { etiqueta: string; ok: boolean }[] = [
      { etiqueta: 'mail', ok: !!textoODefecto(cli.email) },
      { etiqueta: 'RUT', ok: !!textoODefecto(cli.ruc) },
      {
        etiqueta: 'coordenadas',
        ok: d.lat !== null && d.lng !== null && esCoordenadaUruguaya(d.lat, d.lng),
      },
      { etiqueta: 'esquinas', ok: !!d.esq1Id && !!d.esq2Id },
      { etiqueta: 'observaciones', ok: !!textoODefecto(cli.obs) },
    ];
    const ok = items.filter((i) => i.ok).length;
    return {
      pct: Math.round((ok / items.length) * 100),
      faltan: items.filter((i) => !i.ok).map((i) => i.etiqueta),
    };
  }

  // ─────────────────────────── Escritura ────────────────────────────────────

  /**
   * Guarda la ficha. Orden inviolable: validar → AS400 → Postgres → auditar.
   * El operador sale del token (nunca del payload): es lo que queda en CLIOPUPD.
   */
  async guardar(
    cliid: number,
    cambios: Record<string, unknown>,
    operador: string,
  ): Promise<GuardarResultadoDto> {
    const advertencias: string[] = [];

    // Primero se valida el payload: un cuerpo mal armado no tiene por qué
    // costarle un viaje al AS400.
    const { normalizados, columnas, aplicados, errores } = this.traducir(cambios);
    if (errores.length > 0) {
      throw new BadRequestException({
        mensaje: 'Hay cambios que no se pueden guardar',
        errores,
      });
    }
    if (aplicados.length === 0) {
      throw new BadRequestException('No mandaste ningún cambio para guardar');
    }

    // El GET previo es obligatorio: sin él no hay "antes" para el diff de la
    // auditoría (el AS400 no tiene triggers que lo hagan por nosotros).
    const previo = await this.as400.cliente(cliid);

    this.resolverGeo(normalizados, columnas, previo);

    // Trazabilidad: siempre, y con el usuario real del token.
    columnas.CLIOPUPD = operador;
    columnas.CLIFCH = hoyAs400();

    const diff = this.armarDiff(previo, columnas);

    // 1) AS400. Si falla, se aborta: Postgres no se toca.
    let afectados = 0;
    try {
      const r = await this.as400.actualizar(cliid, columnas);
      afectados = r.afectados;
    } catch (e) {
      const detalle = mensajeDeError(e);
      await this.auditar(cliid, operador, diff, false, false, detalle);
      if (e instanceof NotFoundException) throw e;
      throw new HttpException(
        {
          ok: false,
          etapa: 'as400',
          mensaje: `No se pudo guardar en el AS400: ${detalle}. No se modificó nada, probá de nuevo.`,
          error: detalle,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
    this.logger.log(
      `Ficha ${cliid} escrita en AS400 por ${operador}: ${Object.keys(columnas).join(', ')} (afectados=${afectados})`,
    );

    // 2) Postgres (espejo). Si falla, el AS400 ya quedó bien → 207.
    let postgres = { cliente: false, clienteUni: false, direccion: false };
    try {
      postgres = await this.espejar(cliid, normalizados, operador, advertencias);
    } catch (e) {
      const detalle = mensajeDeError(e);
      this.logger.error(`Espejo en Postgres de la ficha ${cliid} falló: ${detalle}`);
      await this.auditar(cliid, operador, diff, true, false, detalle);
      throw new HttpException(
        {
          ok: false,
          etapa: 'postgres',
          aplicados,
          as400: { afectados },
          advertencias,
          mensaje:
            'Se guardó en el AS400 pero no se pudo actualizar goya. El dato del cliente está a salvo; ' +
            'avisá a sistemas para sincronizar.',
          error: detalle,
        },
        HTTP_MULTI_STATUS,
      );
    }

    await this.auditar(cliid, operador, diff, true, true, null);
    return { ok: true, aplicados, as400: { afectados }, postgres, advertencias };
  }

  /** Claves del DTO → columnas del AS400 + valores normalizados para Postgres. */
  private traducir(cambios: Record<string, unknown>): {
    normalizados: CambiosNormalizados;
    columnas: Record<string, ValorAs400>;
    aplicados: string[];
    errores: string[];
  } {
    const normalizados: CambiosNormalizados = {};
    const columnas: Record<string, ValorAs400> = {};
    const aplicados: string[] = [];
    const errores: string[] = [];

    if (!cambios || typeof cambios !== 'object') {
      return { normalizados, columnas, aplicados, errores: ['El cuerpo no trae cambios'] };
    }

    for (const [ruta, valor] of Object.entries(aplanar(cambios))) {
      // `esquina1: null` (o `esquina2`) = "sacar la esquina": limpia id y nombre.
      const esquinaVacia = /^direccion\.esquina([12])$/.exec(ruta);
      if (esquinaVacia && valor === null) {
        const uno = esquinaVacia[1] === '1';
        normalizados[uno ? 'esq1Id' : 'esq2Id'] = null;
        normalizados[uno ? 'esq1Nombre' : 'esq2Nombre'] = null;
        columnas[uno ? 'CALESQ1ID' : 'CALESQ2ID'] = VACIO_NUMERICO;
        aplicados.push(ruta);
        continue;
      }

      // hasOwnProperty y no `CAMPOS_DTO[ruta]`: "constructor" o "toString"
      // heredan del prototipo y pasarían por definiciones válidas.
      if (!Object.prototype.hasOwnProperty.call(CAMPOS_DTO, ruta)) {
        errores.push(`"${ruta}" no es un campo editable de la ficha`);
        continue;
      }
      const def = CAMPOS_DTO[ruta];
      const r = this.normalizarValor(def, valor);
      if (!r.ok) {
        errores.push(r.error);
        continue;
      }
      (normalizados as unknown as Record<string, ValorAs400>)[def.clave] = r.valor;
      if (def.columna) columnas[def.columna] = valorParaAs400(def, r.valor);
      aplicados.push(ruta);
    }

    return { normalizados, columnas, aplicados, errores };
  }

  private normalizarValor(def: DefinicionCampo, valor: unknown): Normalizacion {
    if (valor === undefined || valor === null) return { ok: true, valor: null };

    if (def.tipo === 'char') {
      if (typeof valor === 'object') {
        return { ok: false, error: `${def.etiqueta} tiene que ser texto` };
      }
      const texto = String(valor).trim();
      if (def.largo !== undefined && texto.length > def.largo) {
        return {
          ok: false,
          error: `${def.etiqueta} no puede pasar de ${def.largo} caracteres (mandaste ${texto.length})`,
        };
      }
      return { ok: true, valor: texto };
    }

    // Para números, el string vacío es "borrar el dato", no un cero tipeado.
    if (typeof valor === 'string' && valor.trim() === '') return { ok: true, valor: null };
    if (typeof valor === 'object' || typeof valor === 'boolean') {
      return { ok: false, error: `${def.etiqueta} tiene que ser un número` };
    }

    const numero = typeof valor === 'number' ? valor : Number(String(valor).replace(',', '.'));
    if (!Number.isFinite(numero)) {
      return { ok: false, error: `${def.etiqueta} tiene que ser un número (llegó "${String(valor)}")` };
    }

    if (def.tipo === 'int') {
      if (!Number.isInteger(numero)) {
        return { ok: false, error: `${def.etiqueta} tiene que ser un número entero` };
      }
      const maximo = def.maximo ?? Number.MAX_SAFE_INTEGER;
      if (numero < 0 || numero > maximo) {
        return { ok: false, error: `${def.etiqueta} tiene que estar entre 0 y ${maximo}` };
      }
      return { ok: true, valor: numero };
    }

    const escala = def.escala ?? 0;
    const precision = def.precision ?? 13;
    const enteros = Math.floor(Math.abs(numero)).toString().length;
    if (enteros > precision - escala) {
      return {
        ok: false,
        error: `${def.etiqueta} no entra en la columna del AS400 (máximo ${precision - escala} dígitos enteros)`,
      };
    }
    const factor = 10 ** escala;
    return { ok: true, valor: Math.round(numero * factor) / factor };
  }

  /**
   * Coordenadas: valida que el pin caiga en Uruguay, calcula el UTM 21S que
   * espera el sistema viejo (DIRICAX/DIRICAY) y estampa la fecha de geo.
   * Muta `normalizados` y `columnas` a propósito: es el único lugar donde se
   * derivan campos que el operador no manda.
   */
  private resolverGeo(
    normalizados: CambiosNormalizados,
    columnas: Record<string, ValorAs400>,
    previo: ClienteAs400,
  ): void {
    if (normalizados.lat === undefined && normalizados.lng === undefined) return;

    const lat = normalizados.lat !== undefined ? normalizados.lat : previo.direccion.lat;
    const lng = normalizados.lng !== undefined ? normalizados.lng : previo.direccion.lng;

    // Borrar el pin: en el AS400 "sin dato" es 0 (así lo lee el VB6); en goya,
    // NULL. No se estampa DIRFCHGEO porque no se geolocalizó nada.
    if (lat === null && lng === null) {
      normalizados.lat = null;
      normalizados.lng = null;
      normalizados.utmX = null;
      normalizados.utmY = null;
      columnas.DIRCORX = VACIO_NUMERICO;
      columnas.DIRCORY = VACIO_NUMERICO;
      columnas.DIRICAX = VACIO_NUMERICO;
      columnas.DIRICAY = VACIO_NUMERICO;
      return;
    }

    if (lat === null || lng === null) {
      throw new BadRequestException(
        'Para mover el pin hacen falta latitud y longitud: llegó una sola de las dos',
      );
    }
    if (!esCoordenadaUruguaya(lat, lng)) {
      throw new BadRequestException(
        `El pin (${lat}, ${lng}) cae fuera de Uruguay: revisá la ubicación antes de guardar`,
      );
    }

    const utm = latLngAUtm21S(lat, lng);
    const fechaGeo = hoyAs400();

    normalizados.lat = lat;
    normalizados.lng = lng;
    normalizados.utmX = utm.x;
    normalizados.utmY = utm.y;
    normalizados.fechaGeo = fechaGeo;

    columnas.DIRCORX = lat;
    columnas.DIRCORY = lng;
    columnas.DIRICAX = utm.x;
    columnas.DIRICAY = utm.y;
    columnas.DIRFCHGEO = fechaGeo;
    // ICAMET no se escribe a propósito: su semántica no está confirmada y un
    // código desconocido puede confundir al sistema viejo (decisión de la spec).
  }

  /** El espejo en goya. Todo o nada: una sola transacción. */
  private async espejar(
    cliid: number,
    n: CambiosNormalizados,
    operador: string,
    advertencias: string[],
  ): Promise<{ cliente: boolean; clienteUni: boolean; direccion: boolean }> {
    const ahora = new Date();
    const hoy = fechaAs400ADate(hoyAs400());

    // Timeout explícito: con los 5 s por defecto de Prisma, una base lenta corta
    // la transacción y la respuesta pasa a ser un 207 (AS400 escrito, goya no),
    // que después hay que reconciliar a mano. Barato darle aire.
    return this.prisma.$transaction(async (tx) => {
      const resultado = { cliente: false, clienteUni: false, direccion: false };

      // Nombres de calle/esquinas para cliente_direccion (que guarda texto, no ids).
      const idsAResolver = [
        n.calleNombre === undefined && n.calid ? n.calid : null,
        n.esq1Nombre === undefined && n.esq1Id ? n.esq1Id : null,
        n.esq2Nombre === undefined && n.esq2Id ? n.esq2Id : null,
      ].filter((v): v is number => typeof v === 'number');
      const nombresCalle = new Map<number, string | null>();
      if (idsAResolver.length > 0) {
        const filas = await tx.calle.findMany({
          where: { id: { in: idsAResolver } },
          select: { id: true, nombre: true },
        });
        for (const f of filas) nombresCalle.set(f.id, f.nombre);
      }
      const nombreDe = (
        explicito: string | null | undefined,
        id: number | null | undefined,
        etiqueta: string,
      ): string | null | undefined => {
        if (explicito !== undefined) return explicito;
        if (id === undefined) return undefined;
        if (id === null || id === 0) return null;
        const nombre = nombresCalle.get(id);
        if (nombre === undefined) {
          // El CALID existe en el AS400 pero todavía no en el nomenclator de
          // goya. Antes esto dejaba el texto en NULL: se borraba la calle de la
          // dirección. Se prefiere no tocarla y avisar.
          advertencias.push(
            `${etiqueta} (CALID ${id}) todavía no está en el nomenclator de goya: se guardó el id, el nombre lo trae la próxima importación`,
          );
          return undefined;
        }
        return nombre;
      };

      // ── cliente (espejo 1:1 del AS400, PK = cliid) ──
      const datosCliente: Prisma.ClienteUpdateInput = {
        operadorModificacion: operador,
        fecha: hoy,
      };
      if (n.nombre !== undefined) datosCliente.nombre = n.nombre;
      if (n.mail !== undefined) datosCliente.email = n.mail;
      if (n.rut !== undefined) datosCliente.ruc = n.rut === null ? null : String(n.rut);
      if (n.obsCliente !== undefined) datosCliente.observaciones = n.obsCliente;
      if (n.obsComercial !== undefined) datosCliente.observacionesComerciales = n.obsComercial;
      if (n.calid !== undefined) datosCliente.callePrincipalId = n.calid;
      if (n.numero !== undefined) datosCliente.numeroPuerta = n.numero;
      if (n.esq1Id !== undefined) datosCliente.calleEsquina1Id = n.esq1Id;
      if (n.esq2Id !== undefined) datosCliente.calleEsquina2Id = n.esq2Id;
      if (n.obsDireccion !== undefined) datosCliente.observacionesDireccion = n.obsDireccion;
      if (n.apto !== undefined) datosCliente.apartamento = n.apto;
      if (n.blockSolar !== undefined) datosCliente.blockSolar = n.blockSolar;
      if (n.manzana !== undefined) datosCliente.numeroManzana = n.manzana;
      if (n.km !== undefined) datosCliente.km = n.km;
      if (n.nivel !== undefined) datosCliente.nivel = n.nivel;
      if (n.local !== undefined) datosCliente.local = n.local;
      if (n.bis !== undefined) datosCliente.bis = n.bis;
      if (n.lat !== undefined || n.lng !== undefined) {
        // DIRCORX = latitud, DIRCORY = longitud (nombres invertidos en origen).
        datosCliente.coordenadaX = n.lat ?? null;
        datosCliente.coordenadaY = n.lng ?? null;
        datosCliente.geoLat = n.lat ?? null;
        datosCliente.geoLng = n.lng ?? null;
        datosCliente.icaCoordenadaX = n.utmX ?? null;
        datosCliente.icaCoordenadaY = n.utmY ?? null;
        // El operador miró el pin en las dos ramas (lo movió o lo borró): eso
        // ES una verificación. Lo que NO se toca al borrar es la procedencia ni
        // DIRFCHGEO: en el AS400 tampoco se limpian, y dejar Postgres diciendo
        // "geolocalizado por goya-osm el <null>" sería mentir sobre el dato.
        datosCliente.geoVerificadoAt = ahora;
        if (n.fechaGeo) {
          datosCliente.geoFuente = GEO_FUENTE;
          datosCliente.fechaGeolocalizacion = fechaAs400ADate(n.fechaGeo);
        }
      }

      // ¿Cambió algo de lo que compone el texto de la dirección? Si sí, hay que
      // reconstruirlo (ver `construirDireccion`).
      const tocaTextoDireccion =
        n.calid !== undefined ||
        n.calleNombre !== undefined ||
        n.numero !== undefined ||
        n.bis !== undefined ||
        n.esq1Id !== undefined ||
        n.esq1Nombre !== undefined ||
        n.esq2Id !== undefined ||
        n.esq2Nombre !== undefined ||
        n.blockSolar !== undefined ||
        n.manzana !== undefined ||
        n.apto !== undefined ||
        n.km !== undefined;
      let direccionTexto: string | null | undefined;

      const existeCliente = await tx.cliente.findUnique({ where: { id: cliid }, select: { id: true } });
      if (existeCliente) {
        await tx.cliente.update({ where: { id: cliid }, data: datosCliente });
        resultado.cliente = true;
        if (tocaTextoDireccion) {
          // Se relee DESPUÉS del update para armar el texto con los valores ya
          // mezclados (lo que cambió + lo que no se tocó).
          direccionTexto = await this.reconstruirDireccion(tx, cliid);
          if (direccionTexto !== undefined) {
            await tx.cliente.update({ where: { id: cliid }, data: { direccion: direccionTexto } });
          }
        }
      } else {
        // Alta nueva del AS400: no se crea acá, el reimport la trae completa.
        advertencias.push(
          'El cliente todavía no está en la base de goya: se guardó en el AS400 y la próxima importación lo va a traer',
        );
      }

      // ── cliente_uni + su dirección principal ──
      // findFirst + orderBy: la unique de cliente_uni incluye idOriginalPuesto
      // (nullable), así que no sirve para un findUnique; el orden fija cuál
      // se edita si alguna vez hubiera duplicados.
      const uni = await tx.clienteUni.findFirst({
        where: { origen: ORIGEN_CAPITAL, idOriginal: cliid },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (uni) {
        const datosUni: Prisma.ClienteUniUpdateInput = {
          operadorModificacion: operador,
          editadoPanelAt: ahora,
        };
        if (n.nombre !== undefined) datosUni.nombre = n.nombre;
        if (n.mail !== undefined) datosUni.email = n.mail;
        if (n.rut !== undefined) datosUni.ruc = n.rut === null ? null : String(n.rut);
        if (n.obsCliente !== undefined) datosUni.observaciones = n.obsCliente;
        if (n.obsComercial !== undefined) datosUni.observacionesComerc = n.obsComercial;
        await tx.clienteUni.update({ where: { id: uni.id }, data: datosUni });
        resultado.clienteUni = true;

        // TODO(spec): la tabla maestra nombra columnas que `cliente_direccion`
        // no tiene (calleId / numero / calleEsquina1Id / calleEsquina2Id /
        // geoLat / geoLng). El schema real guarda TEXTO: calle, nro, esquina1,
        // esquina2, lat, lng. Se escribe sobre esas; los nombres salen del
        // payload o se resuelven contra `calle` por CALID.
        const datosDir: Prisma.ClienteDireccionUpdateInput = {};
        const calleNombre = nombreDe(n.calleNombre, n.calid, 'La calle');
        if (calleNombre !== undefined) datosDir.calle = calleNombre;
        if (n.numero !== undefined) datosDir.nro = n.numero === null ? null : String(n.numero);
        const esq1 = nombreDe(n.esq1Nombre, n.esq1Id, 'La esquina 1');
        if (esq1 !== undefined) datosDir.esquina1 = esq1;
        const esq2 = nombreDe(n.esq2Nombre, n.esq2Id, 'La esquina 2');
        if (esq2 !== undefined) datosDir.esquina2 = esq2;
        if (n.lat !== undefined) datosDir.lat = n.lat;
        if (n.lng !== undefined) datosDir.lng = n.lng;
        if (n.obsDireccion !== undefined) datosDir.observaciones = n.obsDireccion;
        // Los avanzados también están espejados en cliente_direccion. Como el
        // `editadoPanelAt` de abajo congela la fila para el sync semanal, lo que
        // no se copie acá queda desactualizado para siempre.
        if (n.bis !== undefined) datosDir.bis = n.bis;
        if (n.apto !== undefined) datosDir.apto = n.apto;
        if (n.blockSolar !== undefined) datosDir.blockSolar = n.blockSolar;
        if (n.nivel !== undefined) datosDir.nivel = n.nivel;
        if (n.local !== undefined) datosDir.local = n.local;
        if (n.manzana !== undefined) datosDir.manzana = n.manzana;
        if (n.km !== undefined) datosDir.km = n.km === null ? null : String(n.km);
        // El texto completo + su clave de búsqueda: sin esto el panel sigue
        // encontrando (y mostrando) la dirección vieja.
        if (direccionTexto !== undefined) {
          datosDir.direccion = direccionTexto;
          datosDir.direccionBusq = direccionTexto ? busquedaNorm(direccionTexto) : null;
        }

        if (Object.keys(datosDir).length > 0) {
          const dir = await tx.clienteDireccion.findFirst({
            where: { clienteId: uni.id },
            orderBy: [{ principal: 'desc' }, { id: 'asc' }],
            select: { id: true },
          });
          if (dir) {
            datosDir.editadoPanelAt = ahora;
            await tx.clienteDireccion.update({ where: { id: dir.id }, data: datosDir });
            resultado.direccion = true;
          } else {
            advertencias.push(
              'El cliente no tiene dirección cargada en goya: la dirección se guardó solo en el AS400',
            );
          }
        }
      } else {
        advertencias.push(
          'El cliente no está en el modelo unificado de goya (cliente_uni): se guardó en el AS400 y en el espejo',
        );
      }

      return resultado;
    }, { timeout: 15_000 });
  }

  /**
   * Rearma `cliente.direccion` con los valores YA mezclados de la fila (por eso
   * se llama después del update y adentro de la misma transacción).
   * Devuelve `undefined` si el cliente no está: ahí no hay nada que reconstruir.
   */
  private async reconstruirDireccion(
    tx: Prisma.TransactionClient,
    cliid: number,
  ): Promise<string | null | undefined> {
    const c = await tx.cliente.findUnique({
      where: { id: cliid },
      select: {
        callePrincipalId: true,
        calleEsquina1Id: true,
        calleEsquina2Id: true,
        calleGeo: true,
        numeroPuerta: true,
        numeroPuertaGeo: true,
        bis: true,
        blockSolar: true,
        numeroManzana: true,
        apartamento: true,
        km: true,
        localidadGeo: true,
      },
    });
    if (!c) return undefined;

    const ids = [c.callePrincipalId, c.calleEsquina1Id, c.calleEsquina2Id].filter(
      (v): v is number => typeof v === 'number' && v > 0,
    );
    const nombres = new Map<number, string | null>();
    if (ids.length > 0) {
      const filas = await tx.calle.findMany({
        where: { id: { in: ids } },
        select: { id: true, nombre: true },
      });
      for (const f of filas) nombres.set(f.id, f.nombre);
    }
    const nombre = (id: number | null): string | null => (id ? (nombres.get(id) ?? null) : null);

    return construirDireccion({
      // Igual que el ETL: manda el nombre del nomenclator y recién si no hay,
      // el que devolvió la geoinversa.
      calle: nombre(c.callePrincipalId) ?? c.calleGeo,
      nro: c.numeroPuerta ? String(c.numeroPuerta) : (c.numeroPuertaGeo ?? null),
      bis: c.bis,
      esq1: nombre(c.calleEsquina1Id),
      esq2: nombre(c.calleEsquina2Id),
      solar: c.blockSolar,
      mz: c.numeroManzana,
      apto: c.apartamento,
      km: c.km !== null && Number(c.km) !== 0 ? c.km.toString() : null,
      localidad: c.localidadGeo,
    });
  }

  /** `{COLUMNA: {antes, despues}}` con el "antes" del GET previo. */
  private armarDiff(
    previo: ClienteAs400,
    columnas: Record<string, ValorAs400>,
  ): Record<string, { antes: ValorAs400 | undefined; despues: ValorAs400 }> {
    const diff: Record<string, { antes: ValorAs400 | undefined; despues: ValorAs400 }> = {};
    for (const [columna, despues] of Object.entries(columnas)) {
      diff[columna] = { antes: this.valorPrevio(previo, columna), despues };
    }
    return diff;
  }

  private valorPrevio(previo: ClienteAs400, columna: string): ValorAs400 | undefined {
    const d = previo.direccion;
    switch (columna) {
      case 'CLINOM':
        return previo.nombre;
      case 'CLIMAIL':
        return previo.email;
      case 'CLIRUC':
        return previo.ruc;
      case 'CLIOBS':
        return previo.obs;
      case 'CLIOBSCOM':
        return previo.obsComercial;
      case 'CLIOPUPD':
        return previo.operadorModificacion;
      case 'CLIFCH':
        return previo.fecha;
      case 'CALPRINID':
        return d.calprinid;
      case 'NROPUERTA':
        return d.nroPuerta;
      case 'CALESQ1ID':
        return d.esq1Id;
      case 'CALESQ2ID':
        return d.esq2Id;
      case 'DIRCORX':
        return d.lat;
      case 'DIRCORY':
        return d.lng;
      case 'DIRICAX':
        return d.utmX;
      case 'DIRICAY':
        return d.utmY;
      case 'DIRFCHGEO':
        return d.fechaGeo;
      case 'DIROBS':
        return d.dirObs;
      case 'APTO':
        return d.apto;
      case 'BIS':
        return d.bis;
      case 'BLOCKSOL':
        return d.blockSolar;
      case 'NIVEL':
        return d.nivel;
      case 'LOCAL':
        return d.local;
      case 'NROMANZ':
        return d.nroManzana;
      case 'KM':
        return d.km;
      default:
        return undefined;
    }
  }

  /**
   * Auditoría propia: GXCALDTA no tiene triggers, así que el "quién tocó qué"
   * lo dejamos nosotros. Nunca hace fallar el guardado: si no se puede escribir
   * la fila, se loguea con nivel error y se sigue.
   */
  private async auditar(
    clienteId: number,
    operador: string,
    campos: Record<string, { antes: ValorAs400 | undefined; despues: ValorAs400 }>,
    as400Ok: boolean,
    pgOk: boolean,
    error: string | null,
  ): Promise<void> {
    try {
      await this.prisma.fichaAuditoria.create({
        data: {
          clienteId,
          operador,
          origen: ORIGEN_AUDITORIA,
          campos: campos as unknown as Prisma.InputJsonValue,
          as400Ok,
          pgOk,
          error: error ? error.slice(0, 500) : null,
        },
      });
    } catch (e) {
      this.logger.error(
        `No se pudo registrar la auditoría de la ficha ${clienteId} (as400Ok=${as400Ok}, pgOk=${pgOk}): ${mensajeDeError(e)}`,
      );
    }
  }
}
