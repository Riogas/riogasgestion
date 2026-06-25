import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMovilesDto } from './dto/query-moviles.dto';

// ─── Tipos de respuesta ───────────────────────────────────────────────────────

export interface MovilListItem {
  id: number;
  numero: number | null;
  matricula: string | null;
  fleteraNombre: string | null;
  estadoCodigo: number | null;
  estadoNombre: string | null;
  tipoServicio: string | null;
  pedidosPendientes: number | null;
  capacidadLote: number | null;
  ok: 'S' | 'N';
  tieneGps: boolean | null;
  observaciones: string | null;
  ultimaActualizacion: Date | null;
  origen: string;
}

@Injectable()
export class MovilesService {
  constructor(private readonly prisma: PrismaService) {}

  // Catálogos en memoria (movil_estado / servicio NO son relaciones Prisma).
  private async loadEstadoMap(): Promise<Map<string, string | null>> {
    const estados = await this.prisma.movilEstado.findMany();
    const map = new Map<string, string | null>();
    for (const e of estados) {
      map.set(`${e.origen}:${e.codigo}`, e.nombre);
    }
    return map;
  }

  private estadoNombre(
    map: Map<string, string | null>,
    origen: string,
    codigo: number | null,
  ): string | null {
    if (codigo === null || codigo === undefined) return null;
    return map.get(`${origen}:${codigo}`) ?? null;
  }

  private buildWhere(q: QueryMovilesDto): Prisma.MovilWhereInput {
    const where: Prisma.MovilWhereInput = {};
    if (q.origen) where.origen = q.origen;
    if (q.estadoCodigo !== undefined) where.estadoCodigo = q.estadoCodigo;
    if (q.fleteraId !== undefined) where.fleteraId = q.fleteraId;
    if (q.tipoServicio) {
      where.OR = [
        { tipoServicio: { contains: q.tipoServicio, mode: 'insensitive' } },
        { servicioPrincipal: { contains: q.tipoServicio, mode: 'insensitive' } },
      ];
    }

    // rutaIca: existe / no existe fila en movil_ica
    if (q.rutaIca === 'si') where.ica = { some: {} };
    else if (q.rutaIca === 'no') where.ica = { none: {} };

    if (q.search) {
      const s = q.search.trim();
      const conds: Prisma.MovilWhereInput[] = [
        { matricula: { contains: s, mode: 'insensitive' } },
      ];
      const n = Number(s);
      if (!Number.isNaN(n) && Number.isInteger(n)) {
        conds.push({ idOriginal: n });
        conds.push({ numeroMovil: n });
      }
      // search se combina con el resto vía AND
      where.AND = [{ OR: conds }];
    }

    return where;
  }

  async findAll(q: QueryMovilesDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where = this.buildWhere(q);

    // sort: 'movil' | '-movil' (por numeroMovil/idOriginal)
    const desc = q.sort?.startsWith('-');
    const orderBy: Prisma.MovilOrderByWithRelationInput[] = q.sort
      ? [{ numeroMovil: desc ? 'desc' : 'asc' }, { idOriginal: desc ? 'desc' : 'asc' }]
      : [{ idOriginal: 'asc' }];

    const [estadoMap, [rows, total]] = await Promise.all([
      this.loadEstadoMap(),
      this.prisma.$transaction([
        this.prisma.movil.findMany({
          where,
          include: { fletera: true },
          skip: (page - 1) * pageSize,
          take: pageSize,
          orderBy,
        }),
        this.prisma.movil.count({ where }),
      ]),
    ]);

    const data: MovilListItem[] = rows.map((m) => ({
      id: m.id,
      numero: m.numeroMovil ?? m.idOriginal,
      matricula: m.matricula,
      fleteraNombre: m.fletera?.nombre ?? null,
      estadoCodigo: m.estadoCodigo,
      estadoNombre: this.estadoNombre(estadoMap, m.origen, m.estadoCodigo),
      tipoServicio: m.tipoServicio ?? m.servicioPrincipal,
      pedidosPendientes: m.pedidosPendientes,
      capacidadLote: m.capacidadLote,
      ok: m.rutea ? 'S' : 'N',
      tieneGps: m.tieneGps,
      observaciones: m.observaciones,
      ultimaActualizacion: m.ultimaPosicionAt ?? m.updatedAt,
      origen: m.origen,
    }));

    return { data, total, page, pageSize };
  }

  async kpis() {
    const estadoMap = await this.loadEstadoMap();

    // Códigos por categoría a partir de los nombres del catálogo.
    const viajeCodes = new Set<number>();
    const esperaCodes = new Set<number>();
    const estados = await this.prisma.movilEstado.findMany();
    for (const e of estados) {
      const nombre = (e.nombre ?? '').toUpperCase();
      if (nombre.includes('VIAJE')) viajeCodes.add(e.codigo);
      if (nombre.includes('ESPERA') && !nombre.includes('RECARGA')) {
        esperaCodes.add(e.codigo);
      }
    }
    void estadoMap;

    const [total, activosEnViaje, enEspera, sinGps] = await this.prisma.$transaction([
      this.prisma.movil.count(),
      this.prisma.movil.count({
        where: viajeCodes.size
          ? { estadoCodigo: { in: Array.from(viajeCodes) } }
          : { id: -1 },
      }),
      this.prisma.movil.count({
        where: esperaCodes.size
          ? { estadoCodigo: { in: Array.from(esperaCodes) } }
          : { id: -1 },
      }),
      this.prisma.movil.count({
        where: { OR: [{ tieneGps: false }, { tieneGps: null }] },
      }),
    ]);

    return { total, activosEnViaje, enEspera, sinGps };
  }

  async findOne(id: number) {
    const m = await this.prisma.movil.findUnique({
      where: { id },
      include: { fletera: true, destino: true },
    });
    if (!m) {
      throw new NotFoundException(`Móvil ${id} no encontrado`);
    }

    const estadoMap = await this.loadEstadoMap();
    const servicioNombre = m.tipoServicio ?? m.servicioPrincipal;

    return {
      id: m.id,
      origen: m.origen,
      idOriginal: m.idOriginal,
      numero: m.numeroMovil ?? m.idOriginal,
      matricula: m.matricula,
      descripcion: m.descripcion,
      marca: m.marca,
      modelo: m.modelo,
      fleteraId: m.fleteraId,
      fleteraNombre: m.fletera?.nombre ?? null,
      estadoCodigo: m.estadoCodigo,
      estadoNombre: this.estadoNombre(estadoMap, m.origen, m.estadoCodigo),
      tipoServicio: m.tipoServicio,
      servicioPrincipal: m.servicioPrincipal,
      servicioNombre,
      pedidosPendientes: m.pedidosPendientes,
      capacidadLote: m.capacidadLote,
      ok: m.rutea ? 'S' : 'N',
      rutea: m.rutea,
      tieneGps: m.tieneGps,
      gpsReportando: m.gpsReportando,
      telefono: m.telefono,
      latitud: m.latitud,
      longitud: m.longitud,
      destinoId: m.destinoId,
      destinoNombre: m.destino?.nombre ?? null,
      observaciones: m.observaciones,
      ultimaActualizacion: m.ultimaPosicionAt ?? m.updatedAt,
      historico: [] as unknown[],
    };
  }

  async filtros() {
    const [estados, fleteras, servicios] = await Promise.all([
      this.prisma.movilEstado.findMany({ orderBy: { codigo: 'asc' } }),
      this.prisma.empresaFletera.findMany({ orderBy: { nombre: 'asc' } }),
      this.prisma.movil.findMany({
        where: { OR: [{ tipoServicio: { not: null } }, { servicioPrincipal: { not: null } }] },
        select: { tipoServicio: true, servicioPrincipal: true },
      }),
    ]);

    // Estados distinct por nombre (12 filas, interior+capital pueden repetir nombre).
    const estadoSeen = new Set<string>();
    const estadosOut: { codigo: number; nombre: string }[] = [];
    for (const e of estados) {
      const nombre = e.nombre ?? '';
      if (!nombre || estadoSeen.has(nombre)) continue;
      estadoSeen.add(nombre);
      estadosOut.push({ codigo: e.codigo, nombre });
    }

    const servicioSet = new Set<string>();
    for (const s of servicios) {
      const v = (s.tipoServicio ?? s.servicioPrincipal ?? '').trim();
      if (v) servicioSet.add(v);
    }

    return {
      estados: estadosOut,
      servicios: Array.from(servicioSet).sort(),
      fleteras: fleteras.map((f) => ({ id: f.id, nombre: f.nombre })),
    };
  }
}
