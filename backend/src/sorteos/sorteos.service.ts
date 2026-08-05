import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GeoService } from './geo.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CODIGO_REGEX,
  fechaHoraMontevideo,
  fechaMontevideo,
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

/** Solo dígitos; +598 se colapsa al formato local (099123456 / 24001234). */
function normalizarTelefono(raw: string): string {
  const digitos = (raw ?? '').replace(/\D/g, '');
  if (digitos.startsWith('598') && digitos.length > 9) {
    const local = digitos.slice(3);
    return local.startsWith('9') ? `0${local}` : local;
  }
  return digitos;
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

    // Lecturas externas de solo lectura: se resuelven antes de abrir la transacción
    // para no atarla a la latencia/errores de geoip-lite o Nominatim. No-fatales.
    const geoIp = this.geo.porIp(dto.ip);
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
          ip: dto.ip ?? null,
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

  async activar(id: number) {
    const ahora = new Date();

    return this.prisma.$transaction(async (tx) => {
      const sorteo = await tx.sorteo.findUnique({ where: { id } });
      if (!sorteo) throw new NotFoundException(`Sorteo ${id} no encontrado`);
      if (sorteo.estado !== 'borrador') {
        throw new BadRequestException(
          `Solo se puede activar un sorteo en borrador (estado actual: ${sorteo.estado})`,
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
      const sorteo = await tx.sorteo.findUnique({ where: { id } });
      if (!sorteo) throw new NotFoundException(`Sorteo ${id} no encontrado`);

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

      const momentos = generarMomentos(
        restantes,
        this.ventana(sorteo, ahora),
        sorteo.fechaHasta,
      );
      await tx.sorteoMomentoGanador.createMany({
        data: momentos.map((fechaMomento) => ({ sorteoId: id, fechaMomento })),
      });
      this.logger.log(`Sorteo ${id}: ${restantes} momentos pendientes regenerados`);

      return { generados: restantes, ganadores };
    }, TX_MOMENTOS);
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

  async detalle(id: number) {
    const sorteo = await this.buscarSorteo(id);

    const [participaciones, ganadores, premiosEntregados, codigosTotal, codigosUsados, filas] =
      await Promise.all([
        this.prisma.sorteoParticipacion.count({ where: { sorteoId: id } }),
        this.prisma.sorteoParticipacion.count({ where: { sorteoId: id, ganador: true } }),
        this.prisma.sorteoParticipacion.count({ where: { sorteoId: id, premioEntregado: true } }),
        this.prisma.sorteoCodigo.count({ where: { sorteoId: id } }),
        this.prisma.sorteoCodigo.count({ where: { sorteoId: id, estado: 'usado' } }),
        this.prisma.sorteoParticipacion.findMany({
          where: { sorteoId: id },
          select: { createdAt: true, ganador: true, gpsDepartamento: true, ipRegion: true },
        }),
      ]);

    const dias = new Map<string, { fecha: string; cantidad: number; ganadores: number }>();
    const departamentos = new Map<string, number>();
    for (const fila of filas) {
      const fecha = fechaMontevideo(fila.createdAt);
      const dia = dias.get(fecha) ?? { fecha, cantidad: 0, ganadores: 0 };
      dia.cantidad += 1;
      if (fila.ganador) dia.ganadores += 1;
      dias.set(fecha, dia);

      const departamento = (fila.gpsDepartamento ?? fila.ipRegion ?? '').trim();
      if (departamento) {
        departamentos.set(departamento, (departamentos.get(departamento) ?? 0) + 1);
      }
    }

    return {
      ...sorteo,
      stats: {
        participaciones,
        ganadores,
        premiosEntregados,
        codigosTotal,
        codigosUsados,
        porDia: [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)),
        porDepartamento: [...departamentos.entries()]
          .map(([departamento, cantidad]) => ({ departamento, cantidad }))
          .sort((a, b) => b.cantidad - a.cantidad),
      },
    };
  }

  async actualizar(id: number, dto: ActualizarSorteoInput) {
    const actual = await this.buscarSorteo(id);
    this.validarRango(dto.fechaDesde ?? actual.fechaDesde, dto.fechaHasta ?? actual.fechaHasta);

    const sorteo = await this.prisma.sorteo.update({
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

    const cambiaronMomentos =
      (dto.fechaDesde !== undefined && dto.fechaDesde.getTime() !== actual.fechaDesde.getTime()) ||
      (dto.fechaHasta !== undefined && dto.fechaHasta.getTime() !== actual.fechaHasta.getTime()) ||
      (dto.cantidadPremios !== undefined && dto.cantidadPremios !== actual.cantidadPremios);

    if (sorteo.estado === 'activo' && cambiaronMomentos) {
      await this.regenerarMomentosPendientes(id);
    }

    return sorteo;
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

  async exportarParticipacionesCsv(sorteoId: number): Promise<string> {
    await this.buscarSorteo(sorteoId);

    const filas = await this.prisma.sorteoParticipacion.findMany({
      where: { sorteoId },
      orderBy: { id: 'asc' },
      include: { codigo: { select: { codigo: true } } },
    });

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
      ].map(csvCampo),
    );

    const cuerpo = [columnas.map(csvCampo), ...lineas].map((c) => c.join(';')).join('\r\n');
    // BOM para que Excel en español abra el UTF-8 sin romper los acentos.
    return `\uFEFF${cuerpo}\r\n`;
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
