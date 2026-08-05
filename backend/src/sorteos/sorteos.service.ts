import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GeoService } from './geo.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CODIGO_REGEX,
  fechaHoraMontevideo,
  formatearCanje,
  generarCodigo,
  generarMomentos,
  inicioDiaMontevideo,
} from './sorteos.util';

export interface EstadoPublico {
  estado: 'ok' | 'usado' | 'no_iniciado' | 'finalizado' | 'invalido';
  sorteo?: { nombre: string; premioDescripcion: string; edadMinima: number };
}

export interface ResultadoParticipacion {
  resultado:
    | 'ganador'
    | 'sigue'
    | 'usado'
    | 'invalido'
    | 'no_iniciado'
    | 'finalizado'
    | 'limite_dispositivo'
    | 'edad_invalida';
  codigoCanje?: string;
}

export interface ParticiparInput {
  codigo: string;
  nombre: string;
  telefono: string;
  edad: number;
  email?: string;
  deviceId: string;
  fingerprint?: string;
  userAgent?: string;
  ip?: string;
  idioma?: string;
  plataforma?: string;
  resolucion?: string;
  gpsLat?: number;
  gpsLng?: number;
}

interface SorteoVigencia {
  estado: string;
  fechaDesde: Date;
  fechaHasta: Date;
}

interface SorteoRegenerable extends SorteoVigencia {
  id: number;
  cantidadPremios: number;
}

/** Cliente de Prisma dentro de un `$transaction` interactivo. */
type TxCliente = Prisma.TransactionClient;

export interface RegeneracionMomentos {
  generados: number;
  ganadores: number;
  /** true cuando el sorteo no estaba en condiciones de regenerar y no se tocó nada. */
  omitido?: boolean;
}

export interface ListarSorteosQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  estado?: string;
}

export interface ListarParticipacionesQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  soloGanadores?: boolean;
}

export interface CrearSorteoInput {
  nombre: string;
  descripcion?: string;
  premioDescripcion: string;
  fechaDesde: Date;
  fechaHasta: Date;
  cantidadPremios: number;
  maxRegistrosDispositivoDia?: number;
  edadMinima?: number;
}

export type ActualizarSorteoInput = Partial<CrearSorteoInput>;

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 200;

/** Los createMany masivos (hasta 100.000 momentos / 10.000 códigos) no entran en los 5s default. */
const TX_MOMENTOS = { timeout: 60_000, maxWait: 15_000 };

/** Filas por vuelta del CSV: una campaña grande son cientos de miles de participaciones. */
const CSV_BATCH = 500;

/** Violación de unique de Postgres vía Prisma (el `instanceof` no sobrevive al mock). */
function esColisionDeCodigo(e: unknown): boolean {
  return (e as { code?: unknown } | null)?.code === 'P2002';
}

/**
 * Campo CSV con separador `;` (RFC4180 adaptado). `nombre`/`email` los escribe
 * cualquiera desde el formulario público: un valor que arranca con `=`, `+`,
 * `-` o `@` lo ejecuta Excel como fórmula al abrir el archivo, así que se
 * neutraliza con una comilla simple adelante.
 */
function csvCampo(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  const texto = /^[=+\-@\t\r]/.test(String(valor)) ? `'${String(valor)}` : String(valor);
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function csvBooleano(valor: boolean): string {
  return valor ? 'Sí' : 'No';
}

/** Celular (09 + 7 cifras) o fijo (2/4 + 7 cifras), ya normalizado. */
const TELEFONO_UY_REGEX = /^(09\d{7}|[24]\d{7})$/;

/**
 * Forma canónica del teléfono: mismo algoritmo que `normalizarTelefonoUy` del
 * front (`src/components/sorteo/SorteoForm.tsx`). Es la clave del tope de
 * "1 premio por teléfono por sorteo" (advisory lock + count de ganadores), así
 * que front y back tienen que coincidir: si el back es más laxo, el mismo número
 * escrito distinto (`00598…`, `598…`, `9XXXXXXX`) genera identidades distintas y
 * el tope se saltea. Lo que no canoniza a un teléfono uruguayo válido se guarda
 * como los dígitos crudos (no se inventa un formato a medias).
 */
function normalizarTelefono(raw: string): string {
  const crudo = (raw ?? '').replace(/\D+/g, '');
  let digitos = crudo;
  if (digitos.startsWith('00598') && digitos.length > 11) digitos = digitos.slice(5);
  else if (digitos.startsWith('598') && digitos.length > 9) digitos = digitos.slice(3);
  if (/^9\d{7}$/.test(digitos)) digitos = `0${digitos}`;
  return TELEFONO_UY_REGEX.test(digitos) ? digitos : crudo;
}

/** Ancho de la columna `ip` (VarChar(45), suficiente para IPv6 con zona). */
const IP_MAX = 45;

/**
 * La ip llega de `x-forwarded-for`: es un header que escribe el cliente. Se
 * recorta al ancho de la columna y se descarta lo que no parece una IP (un valor
 * más largo que la columna aborta la transacción entera de participar).
 */
function normalizarIp(raw?: string): string | null {
  const valor = (raw ?? '').trim().slice(0, IP_MAX);
  if (!valor) return null;

  const esV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(valor);
  const esV6 = /^[0-9A-Fa-f:]+$/.test(valor) && valor.includes(':');
  const esV4EnV6 = /^[0-9A-Fa-f:]+:(\d{1,3}\.){3}\d{1,3}$/.test(valor);
  return esV4 || esV6 || esV4EnV6 ? valor : null;
}

@Injectable()
export class SorteosService {
  private readonly logger = new Logger(SorteosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geo: GeoService,
  ) {}

  // ─── Vigencia ───────────────────────────────────────────────────────────────

  private vigencia(sorteo: SorteoVigencia, ahora: Date): 'no_iniciado' | 'finalizado' | null {
    if (sorteo.estado === 'borrador' || sorteo.estado === 'cancelado') return 'no_iniciado';
    if (ahora < sorteo.fechaDesde) return 'no_iniciado';
    if (sorteo.estado === 'finalizado' || ahora > sorteo.fechaHasta) return 'finalizado';
    return null;
  }

  private normalizarCodigo(codigo: string): string | null {
    const limpio = (codigo ?? '').trim().toUpperCase();
    return CODIGO_REGEX.test(limpio) ? limpio : null;
  }

  // ─── Público ────────────────────────────────────────────────────────────────

  async estadoPublico(codigo: string): Promise<EstadoPublico> {
    const limpio = this.normalizarCodigo(codigo);
    if (!limpio) return { estado: 'invalido' };

    const row = await this.prisma.sorteoCodigo.findUnique({
      where: { codigo: limpio },
      include: { sorteo: true },
    });
    if (!row) return { estado: 'invalido' };

    const fuera = this.vigencia(row.sorteo, new Date());
    if (fuera) return { estado: fuera };
    if (row.estado !== 'disponible') return { estado: 'usado' };

    return {
      estado: 'ok',
      sorteo: {
        nombre: row.sorteo.nombre,
        premioDescripcion: row.sorteo.premioDescripcion,
        edadMinima: row.sorteo.edadMinima,
      },
    };
  }

  async participar(dto: ParticiparInput): Promise<ResultadoParticipacion> {
    const limpio = this.normalizarCodigo(dto.codigo);
    if (!limpio) return { resultado: 'invalido' };

    const ahora = new Date();
    const tieneGps = dto.gpsLat != null && dto.gpsLng != null;
    const ip = normalizarIp(dto.ip);

    // Pre-chequeo barato antes de gastar red: sin esto un código inválido, vencido
    // o ya usado igual dispara el reverse geocoding contra Nominatim. La transacción
    // vuelve a validar todo (esto es solo un descarte temprano, no la autoridad).
    const previo = await this.prisma.sorteoCodigo.findUnique({
      where: { codigo: limpio },
      include: { sorteo: true },
    });
    if (!previo) return { resultado: 'invalido' };
    const fueraPrevio = this.vigencia(previo.sorteo, ahora);
    if (fueraPrevio) return { resultado: fueraPrevio };
    if (previo.estado !== 'disponible') return { resultado: 'usado' };
    if (dto.edad < previo.sorteo.edadMinima) return { resultado: 'edad_invalida' };

    // Lecturas externas de solo lectura: se resuelven antes de abrir la transacción
    // para no atarla a la latencia/errores de geoip-lite o Nominatim. No-fatales.
    const geoIp = this.geo.porIp(ip ?? undefined);
    const geoGps = tieneGps ? await this.geo.reverse(dto.gpsLat as number, dto.gpsLng as number) : {};
    const geoFuente = tieneGps ? 'gps' : geoIp.ipPais ? 'ip' : null;

    return this.prisma.$transaction(async (tx): Promise<ResultadoParticipacion> => {
      const codigo = await tx.sorteoCodigo.findUnique({
        where: { codigo: limpio },
        include: { sorteo: true },
      });
      if (!codigo) return { resultado: 'invalido' };

      const sorteo = codigo.sorteo;
      const fuera = this.vigencia(sorteo, ahora);
      if (fuera) return { resultado: fuera };
      if (codigo.estado !== 'disponible') return { resultado: 'usado' };
      if (dto.edad < sorteo.edadMinima) return { resultado: 'edad_invalida' };

      // Sin este lock el count-then-create es un TOCTOU: N requests paralelas del
      // mismo dispositivo leen todas "0 registros hoy" y todas insertan.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sorteo:${sorteo.id}:device:${dto.deviceId}`}))`;

      const registrosHoy = await tx.sorteoParticipacion.count({
        where: {
          sorteoId: sorteo.id,
          deviceId: dto.deviceId,
          createdAt: { gte: inicioDiaMontevideo(ahora) },
        },
      });
      if (registrosHoy >= sorteo.maxRegistrosDispositivoDia) {
        return { resultado: 'limite_dispositivo' };
      }

      // Consumo atómico: el perdedor de la carrera ve el código como usado.
      const consumo = await tx.sorteoCodigo.updateMany({
        where: { id: codigo.id, estado: 'disponible' },
        data: { estado: 'usado', usadoAt: ahora },
      });
      if (consumo.count === 0) return { resultado: 'usado' };

      const telefono = normalizarTelefono(dto.telefono);

      const participacion = await tx.sorteoParticipacion.create({
        data: {
          sorteoId: sorteo.id,
          codigoId: codigo.id,
          nombre: dto.nombre.trim(),
          telefono,
          edad: dto.edad,
          email: dto.email?.trim() || null,
          deviceId: dto.deviceId,
          fingerprint: dto.fingerprint ?? null,
          userAgent: dto.userAgent ?? null,
          ip,
          idioma: dto.idioma ?? null,
          plataforma: dto.plataforma ?? null,
          resolucion: dto.resolucion ?? null,
          gpsLat: tieneGps ? dto.gpsLat : null,
          gpsLng: tieneGps ? dto.gpsLng : null,
          ipPais: geoIp.ipPais ?? null,
          ipRegion: geoIp.ipRegion ?? null,
          ipCiudad: geoIp.ipCiudad ?? null,
          gpsPais: geoGps.gpsPais ?? null,
          gpsDepartamento: geoGps.gpsDepartamento ?? null,
          gpsLocalidad: geoGps.gpsLocalidad ?? null,
          geoFuente,
        },
      });

      // Serializa las confirmaciones del mismo teléfono en el mismo sorteo: sin esto,
      // dos requests paralelos pueden ver "todavía no ganó" y reclamar dos momentos
      // distintos. Se libera solo al commit/rollback de la transacción.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sorteo:${sorteo.id}:tel:${telefono}`}))`;

      const yaGano = await tx.sorteoParticipacion.count({
        where: { sorteoId: sorteo.id, telefono, ganador: true },
      });
      if (yaGano === 0) {
        const momento = await tx.sorteoMomentoGanador.findFirst({
          where: { sorteoId: sorteo.id, participacionId: null, fechaMomento: { lte: ahora } },
          orderBy: { fechaMomento: 'asc' },
        });
        if (momento) {
          const claim = await tx.sorteoMomentoGanador.updateMany({
            where: { id: momento.id, participacionId: null },
            data: { participacionId: participacion.id },
          });
          if (claim.count === 1) {
            const codigoCanje = formatearCanje(generarCodigo(8));
            await tx.sorteoParticipacion.update({
              where: { id: participacion.id },
              data: { ganador: true, codigoCanje },
            });
            this.logger.log(
              `Sorteo ${sorteo.id}: participación ${participacion.id} ganó el momento ${momento.id}`,
            );
            return { resultado: 'ganador', codigoCanje };
          }
        }
      }

      return { resultado: 'sigue' };
    });
  }

  // ─── Momentos ganadores ─────────────────────────────────────────────────────

  /** Ventana de sorteo todavía jugable: nunca genera momentos en el pasado. */
  private ventana(sorteo: { fechaDesde: Date; fechaHasta: Date }, ahora: Date): Date {
    return new Date(Math.max(ahora.getTime(), sorteo.fechaDesde.getTime()));
  }

  /**
   * Serializa todo lo que toca los momentos de un sorteo (activación, regeneración
   * y la edición que la dispara). Sin esto dos PATCH concurrentes borran cada uno
   * los pendientes del otro y terminan creando dos juegos completos de momentos:
   * el sorteo puede entregar más premios que `cantidadPremios`.
   * Se libera solo con el commit/rollback de la transacción.
   */
  private async lockMomentos(tx: TxCliente, id: number): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`sorteo:${id}:momentos`}))`;
  }

  async activar(id: number) {
    const ahora = new Date();

    return this.prisma.$transaction(async (tx) => {
      await this.lockMomentos(tx, id);

      const sorteo = await tx.sorteo.findUnique({ where: { id } });
      if (!sorteo) throw new NotFoundException(`Sorteo ${id} no encontrado`);
      if (sorteo.estado !== 'borrador') {
        throw new BadRequestException(
          `Solo se puede activar un sorteo en borrador (estado actual: ${sorteo.estado})`,
        );
      }
      // Con la ventana vencida los momentos se colapsarían todos en `ahora`, después
      // del fin del sorteo: quedarían para siempre sin reclamar y el sorteo, activo
      // para el admin y finalizado para el público.
      if (sorteo.fechaHasta <= ahora) {
        throw new BadRequestException(
          'No se puede activar un sorteo cuya fecha de fin ya pasó: corregí las fechas primero',
        );
      }

      const momentos = generarMomentos(
        sorteo.cantidadPremios,
        this.ventana(sorteo, ahora),
        sorteo.fechaHasta,
      );
      await tx.sorteoMomentoGanador.createMany({
        data: momentos.map((fechaMomento) => ({ sorteoId: id, fechaMomento })),
      });
      this.logger.log(`Sorteo ${id} activado con ${momentos.length} momentos ganadores`);

      return tx.sorteo.update({ where: { id }, data: { estado: 'activo' } });
    }, TX_MOMENTOS);
  }

  async regenerarMomentosPendientes(id: number): Promise<RegeneracionMomentos> {
    const ahora = new Date();

    return this.prisma.$transaction(async (tx): Promise<RegeneracionMomentos> => {
      await this.lockMomentos(tx, id);

      const sorteo = await tx.sorteo.findUnique({ where: { id } });
      if (!sorteo) throw new NotFoundException(`Sorteo ${id} no encontrado`);

      return this.regenerarEnTx(tx, sorteo, ahora);
    }, TX_MOMENTOS);
  }

  /** Cuerpo de la regeneración: asume el `lockMomentos` ya tomado en esta transacción. */
  private async regenerarEnTx(
    tx: TxCliente,
    sorteo: SorteoRegenerable,
    ahora: Date,
  ): Promise<RegeneracionMomentos> {
    const id = sorteo.id;

    // Sobre un sorteo que no está corriendo no hay nada que redistribuir: regenerar
    // repoblaría momentos en un sorteo cancelado/finalizado, o los colapsaría todos
    // al mismo instante si la ventana ya venció (todos reclamables de golpe).
    if (sorteo.estado !== 'activo' || sorteo.fechaHasta <= ahora) {
      return { generados: 0, ganadores: 0, omitido: true };
    }

    await tx.sorteoMomentoGanador.deleteMany({ where: { sorteoId: id, participacionId: null } });

    const ganadores = await tx.sorteoMomentoGanador.count({
      where: { sorteoId: id, participacionId: { not: null } },
    });
    const restantes = sorteo.cantidadPremios - ganadores;
    if (restantes <= 0) return { generados: 0, ganadores };

    const momentos = generarMomentos(restantes, this.ventana(sorteo, ahora), sorteo.fechaHasta);
    await tx.sorteoMomentoGanador.createMany({
      data: momentos.map((fechaMomento) => ({ sorteoId: id, fechaMomento })),
    });
    this.logger.log(`Sorteo ${id}: ${restantes} momentos pendientes regenerados`);

    return { generados: restantes, ganadores };
  }

  // ─── Admin: sorteos ─────────────────────────────────────────────────────────

  private paginado(page?: number, pageSize?: number) {
    const p = Math.max(1, Math.trunc(page ?? 1));
    const size = Math.min(PAGE_SIZE_MAX, Math.max(1, Math.trunc(pageSize ?? PAGE_SIZE_DEFAULT)));
    return { skip: (p - 1) * size, take: size };
  }

  private validarRango(fechaDesde: Date, fechaHasta: Date) {
    if (fechaHasta.getTime() <= fechaDesde.getTime()) {
      throw new BadRequestException('fechaHasta debe ser posterior a fechaDesde');
    }
  }

  private async buscarSorteo(id: number) {
    const sorteo = await this.prisma.sorteo.findUnique({ where: { id } });
    if (!sorteo) throw new NotFoundException(`Sorteo ${id} no encontrado`);
    return sorteo;
  }

  async listar(q: ListarSorteosQuery) {
    const { skip, take } = this.paginado(q.page, q.pageSize);

    const where: Prisma.SorteoWhereInput = {};
    if (q.estado) where.estado = q.estado;
    const search = q.search?.trim();
    if (search) where.nombre = { contains: search, mode: 'insensitive' };

    const [rows, total] = await Promise.all([
      this.prisma.sorteo.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
        include: { _count: { select: { participaciones: true, codigos: true } } },
      }),
      this.prisma.sorteo.count({ where }),
    ]);

    const ids = rows.map((r) => r.id);
    const [ganadores, entregados] = await Promise.all([
      this.prisma.sorteoParticipacion.groupBy({
        by: ['sorteoId'],
        where: { sorteoId: { in: ids }, ganador: true },
        _count: { _all: true },
      }),
      this.prisma.sorteoParticipacion.groupBy({
        by: ['sorteoId'],
        where: { sorteoId: { in: ids }, premioEntregado: true },
        _count: { _all: true },
      }),
    ]);
    const porSorteo = (filas: { sorteoId: number; _count: { _all: number } }[]) =>
      new Map(filas.map((f) => [f.sorteoId, f._count._all]));
    const ganadoresPorSorteo = porSorteo(ganadores);
    const entregadosPorSorteo = porSorteo(entregados);

    const items = rows.map(({ _count, ...sorteo }) => ({
      ...sorteo,
      _count: {
        participaciones: _count.participaciones,
        codigos: _count.codigos,
        ganadores: ganadoresPorSorteo.get(sorteo.id) ?? 0,
      },
      premiosEntregados: entregadosPorSorteo.get(sorteo.id) ?? 0,
    }));

    return { items, total };
  }

  async crear(dto: CrearSorteoInput) {
    this.validarRango(dto.fechaDesde, dto.fechaHasta);

    return this.prisma.sorteo.create({
      data: {
        nombre: dto.nombre.trim(),
        descripcion: dto.descripcion?.trim() || null,
        premioDescripcion: dto.premioDescripcion.trim(),
        fechaDesde: dto.fechaDesde,
        fechaHasta: dto.fechaHasta,
        cantidadPremios: dto.cantidadPremios,
        maxRegistrosDispositivoDia: dto.maxRegistrosDispositivoDia,
        edadMinima: dto.edadMinima,
        estado: 'borrador',
      },
    });
  }

  /**
   * Participaciones por día calendario de Montevideo (UTC-3 fijo, sin DST desde
   * 2015 — mismo criterio que `fechaMontevideo`). Se agrupa en SQL: traer todas
   * las filas del sorteo para contarlas en JS no escala a campañas grandes.
   */
  private async porDia(sorteoId: number) {
    const filas = await this.prisma.$queryRaw<
      { fecha: string; cantidad: bigint; ganadores: bigint }[]
    >`
      SELECT to_char("createdAt" - interval '3 hours', 'YYYY-MM-DD') AS fecha,
             COUNT(*) AS cantidad,
             COUNT(*) FILTER (WHERE ganador) AS ganadores
      FROM sorteo_participacion
      WHERE "sorteoId" = ${sorteoId}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return filas.map((f) => ({
      fecha: f.fecha,
      cantidad: Number(f.cantidad),
      ganadores: Number(f.ganadores),
    }));
  }

  /** Participaciones por departamento (GPS y, si no hay, la región de la IP). */
  private async porDepartamento(sorteoId: number) {
    const filas = await this.prisma.$queryRaw<{ departamento: string; cantidad: bigint }[]>`
      SELECT COALESCE(NULLIF(btrim("gpsDepartamento"), ''), NULLIF(btrim("ipRegion"), '')) AS departamento,
             COUNT(*) AS cantidad
      FROM sorteo_participacion
      WHERE "sorteoId" = ${sorteoId}
      GROUP BY 1
      HAVING COALESCE(NULLIF(btrim("gpsDepartamento"), ''), NULLIF(btrim("ipRegion"), '')) IS NOT NULL
      ORDER BY 2 DESC, 1 ASC
    `;
    return filas.map((f) => ({ departamento: f.departamento, cantidad: Number(f.cantidad) }));
  }

  async detalle(id: number) {
    const sorteo = await this.buscarSorteo(id);

    const [
      participaciones,
      ganadores,
      premiosEntregados,
      codigosTotal,
      codigosUsados,
      porDia,
      porDepartamento,
    ] = await Promise.all([
      this.prisma.sorteoParticipacion.count({ where: { sorteoId: id } }),
      this.prisma.sorteoParticipacion.count({ where: { sorteoId: id, ganador: true } }),
      this.prisma.sorteoParticipacion.count({ where: { sorteoId: id, premioEntregado: true } }),
      this.prisma.sorteoCodigo.count({ where: { sorteoId: id } }),
      this.prisma.sorteoCodigo.count({ where: { sorteoId: id, estado: 'usado' } }),
      this.porDia(id),
      this.porDepartamento(id),
    ]);

    return {
      ...sorteo,
      stats: {
        participaciones,
        ganadores,
        premiosEntregados,
        codigosTotal,
        codigosUsados,
        porDia,
        porDepartamento,
      },
    };
  }

  async actualizar(id: number, dto: ActualizarSorteoInput) {
    const actual = await this.buscarSorteo(id);
    this.validarRango(dto.fechaDesde ?? actual.fechaDesde, dto.fechaHasta ?? actual.fechaHasta);

    const cambiaronMomentos =
      (dto.fechaDesde !== undefined && dto.fechaDesde.getTime() !== actual.fechaDesde.getTime()) ||
      (dto.fechaHasta !== undefined && dto.fechaHasta.getTime() !== actual.fechaHasta.getTime()) ||
      (dto.cantidadPremios !== undefined && dto.cantidadPremios !== actual.cantidadPremios);

    const ahora = new Date();

    // El update y la regeneración van en la MISMA transacción (y bajo el mismo lock):
    // separados, un participar() concurrente podía reclamar momentos calculados con
    // las fechas viejas, y dos ediciones simultáneas duplicaban los pendientes.
    return this.prisma.$transaction(async (tx) => {
      await this.lockMomentos(tx, id);

      const sorteo = await tx.sorteo.update({
        where: { id },
        data: {
          nombre: dto.nombre?.trim(),
          descripcion: dto.descripcion === undefined ? undefined : dto.descripcion.trim() || null,
          premioDescripcion: dto.premioDescripcion?.trim(),
          fechaDesde: dto.fechaDesde,
          fechaHasta: dto.fechaHasta,
          cantidadPremios: dto.cantidadPremios,
          maxRegistrosDispositivoDia: dto.maxRegistrosDispositivoDia,
          edadMinima: dto.edadMinima,
        },
      });

      if (sorteo.estado === 'activo' && cambiaronMomentos) {
        await this.regenerarEnTx(tx, sorteo, ahora);
      }

      return sorteo;
    }, TX_MOMENTOS);
  }

  private async cambiarEstado(id: number, destino: string, desde: string[]) {
    const sorteo = await this.buscarSorteo(id);
    if (!desde.includes(sorteo.estado)) {
      throw new BadRequestException(
        `No se puede pasar a ${destino} un sorteo en estado ${sorteo.estado}`,
      );
    }
    this.logger.log(`Sorteo ${id}: ${sorteo.estado} → ${destino}`);
    return this.prisma.sorteo.update({ where: { id }, data: { estado: destino } });
  }

  async finalizar(id: number) {
    return this.cambiarEstado(id, 'finalizado', ['activo']);
  }

  async cancelar(id: number) {
    return this.cambiarEstado(id, 'cancelado', ['borrador', 'activo']);
  }

  // ─── Admin: lotes y códigos ─────────────────────────────────────────────────

  async crearLote(sorteoId: number, cantidad: number, generadoPor: string | null) {
    await this.buscarSorteo(sorteoId);

    try {
      return await this.intentarLote(sorteoId, cantidad, generadoPor);
    } catch (e) {
      if (!esColisionDeCodigo(e)) throw e;
      this.logger.warn(`Sorteo ${sorteoId}: colisión de código generando el lote, reintentando`);
      return this.intentarLote(sorteoId, cantidad, generadoPor);
    }
  }

  private async intentarLote(sorteoId: number, cantidad: number, generadoPor: string | null) {
    // Los códigos se generan fuera de la transacción para no tenerla abierta de gusto.
    const codigos = new Set<string>();
    while (codigos.size < cantidad) codigos.add(generarCodigo());

    return this.prisma.$transaction(
      async (tx) => {
        const lote = await tx.sorteoLote.create({ data: { sorteoId, cantidad, generadoPor } });
        await tx.sorteoCodigo.createMany({
          data: [...codigos].map((codigo) => ({ sorteoId, loteId: lote.id, codigo })),
        });
        this.logger.log(`Sorteo ${sorteoId}: lote ${lote.id} con ${cantidad} códigos`);
        return { id: lote.id, cantidad };
      },
      TX_MOMENTOS,
    );
  }

  async listarLotes(sorteoId: number) {
    await this.buscarSorteo(sorteoId);

    const [lotes, usados] = await Promise.all([
      this.prisma.sorteoLote.findMany({
        where: { sorteoId },
        orderBy: { id: 'desc' },
        include: { _count: { select: { codigos: true } } },
      }),
      this.prisma.sorteoCodigo.groupBy({
        by: ['loteId'],
        where: { sorteoId, estado: 'usado' },
        _count: { _all: true },
      }),
    ]);
    const usadosPorLote = new Map(usados.map((u) => [u.loteId, u._count._all]));

    return lotes.map(({ _count, ...lote }) => ({
      ...lote,
      codigosTotal: _count.codigos,
      codigosUsados: usadosPorLote.get(lote.id) ?? 0,
    }));
  }

  async buscarLote(sorteoId: number, loteId: number) {
    const lote = await this.prisma.sorteoLote.findFirst({ where: { id: loteId, sorteoId } });
    if (!lote) throw new NotFoundException(`Lote ${loteId} no encontrado en el sorteo ${sorteoId}`);
    return lote;
  }

  /** Keyset por id: el ZIP recorre lotes de hasta 10.000 códigos sin cargarlos todos. */
  async codigosDelLote(loteId: number, desdeId: number, take: number) {
    return this.prisma.sorteoCodigo.findMany({
      where: { loteId, id: { gt: desdeId } },
      orderBy: { id: 'asc' },
      take,
      select: { id: true, codigo: true },
    });
  }

  // ─── Admin: participaciones ─────────────────────────────────────────────────

  private whereParticipaciones(
    sorteoId: number,
    q: ListarParticipacionesQuery,
  ): Prisma.SorteoParticipacionWhereInput {
    const where: Prisma.SorteoParticipacionWhereInput = { sorteoId };
    if (q.soloGanadores) where.ganador = true;

    const search = q.search?.trim();
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { telefono: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { codigoCanje: { contains: search, mode: 'insensitive' } },
      ];
    }
    return where;
  }

  async listarParticipaciones(sorteoId: number, q: ListarParticipacionesQuery) {
    await this.buscarSorteo(sorteoId);
    const { skip, take } = this.paginado(q.page, q.pageSize);
    const where = this.whereParticipaciones(sorteoId, q);

    const [items, total] = await Promise.all([
      this.prisma.sorteoParticipacion.findMany({
        where,
        orderBy: { id: 'desc' },
        skip,
        take,
        include: { codigo: { select: { codigo: true } } },
      }),
      this.prisma.sorteoParticipacion.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Exporta el CSV en batches por keyset y se lo va entregando a `escribir`
   * (la response). Materializar todas las participaciones y armar un único string
   * era memoria proporcional a la campaña entera en cada descarga.
   */
  async exportarParticipacionesCsv(
    sorteoId: number,
    escribir: (chunk: string) => void | Promise<void>,
  ): Promise<void> {
    await this.buscarSorteo(sorteoId);

    const columnas = [
      'Id',
      'Fecha',
      'Nombre',
      'Teléfono',
      'Edad',
      'Email',
      'Código',
      'Ganador',
      'Código de canje',
      'Premio entregado',
      'Fecha de entrega',
      'Dispositivo',
      'Fingerprint',
      'User agent',
      'IP',
      'Idioma',
      'Plataforma',
      'Resolución',
      'País (IP)',
      'Región (IP)',
      'Ciudad (IP)',
      'Latitud',
      'Longitud',
      'País (GPS)',
      'Departamento (GPS)',
      'Localidad (GPS)',
      'Fuente geo',
    ];

    // BOM para que Excel en español abra el UTF-8 sin romper los acentos.
    await escribir(`\uFEFF${columnas.map(csvCampo).join(';')}\r\n`);

    let ultimoId = 0;
    for (;;) {
      const filas = await this.prisma.sorteoParticipacion.findMany({
        where: { sorteoId, id: { gt: ultimoId } },
        orderBy: { id: 'asc' },
        take: CSV_BATCH,
        include: { codigo: { select: { codigo: true } } },
      });
      if (filas.length === 0) break;

      const lineas = filas.map((f) =>
        [
          f.id,
          fechaHoraMontevideo(f.createdAt),
          f.nombre,
          f.telefono,
          f.edad,
          f.email,
          f.codigo?.codigo,
          csvBooleano(f.ganador),
          f.codigoCanje,
          csvBooleano(f.premioEntregado),
          f.premioEntregadoAt ? fechaHoraMontevideo(f.premioEntregadoAt) : null,
          f.deviceId,
          f.fingerprint,
          f.userAgent,
          f.ip,
          f.idioma,
          f.plataforma,
          f.resolucion,
          f.ipPais,
          f.ipRegion,
          f.ipCiudad,
          f.gpsLat,
          f.gpsLng,
          f.gpsPais,
          f.gpsDepartamento,
          f.gpsLocalidad,
          f.geoFuente,
        ]
          .map(csvCampo)
          .join(';'),
      );
      await escribir(`${lineas.join('\r\n')}\r\n`);

      ultimoId = filas[filas.length - 1].id;
      if (filas.length < CSV_BATCH) break;
    }
  }

  async marcarPremioEntregado(participacionId: number) {
    const participacion = await this.prisma.sorteoParticipacion.findUnique({
      where: { id: participacionId },
    });
    if (!participacion) {
      throw new NotFoundException(`Participación ${participacionId} no encontrada`);
    }
    if (!participacion.ganador) {
      throw new BadRequestException(`La participación ${participacionId} no es ganadora`);
    }

    return this.prisma.sorteoParticipacion.update({
      where: { id: participacionId },
      data: { premioEntregado: true, premioEntregadoAt: new Date() },
    });
  }
}
