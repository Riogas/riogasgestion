import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryMovilesDto } from './dto/query-moviles.dto';
import { UpdateMovilDto } from './dto/update-movil.dto';

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
      include: {
        fletera: true,
        destino: true,
        stock: { orderBy: { id: 'asc' } },
        puntosRecarga: { orderBy: { id: 'asc' } },
        servicios: { include: { servicio: true }, orderBy: { id: 'asc' } },
        zonas: { orderBy: { id: 'asc' } },
        bodega: { orderBy: { id: 'asc' } },
      },
    });
    if (!m) {
      throw new NotFoundException(`Móvil ${id} no encontrado`);
    }

    const estadoMap = await this.loadEstadoMap();
    const servicioNombre = m.tipoServicio ?? m.servicioPrincipal;

    // Nombre de la calle de "activar por dirección" (catálogo calle).
    let activarDireccionCalleNombre: string | null = null;
    if (m.activarDireccionCalleId) {
      const calle = await this.prisma.calle.findUnique({
        where: { id: m.activarDireccionCalleId },
        select: { nombre: true },
      });
      activarDireccionCalleNombre = calle?.nombre ?? null;
    }

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
      activoDesde: m.activoDesde,
      activoHasta: m.activoHasta,
      ultimaActualizacion: m.ultimaPosicionAt ?? m.updatedAt,

      // Config AS400
      enviarPedidosCelular: m.enviarPedidosCelular,
      reasignacionPuesto: m.reasignacionPuesto,
      activarDireccionCalleId: m.activarDireccionCalleId,
      activarDireccionCalleNombre,
      activarDireccionNro: m.activarDireccionNro,
      coordActivaX: m.coordActivaX,
      coordActivaY: m.coordActivaY,
      tiempoCumplimientoServicio: m.tiempoCumplimientoServicio,

      // Config goya
      dirSms: m.dirSms,
      usaIca: m.usaIca,
      mostrarEnMapa: m.mostrarEnMapa,
      actualizarCoord30s: m.actualizarCoord30s,
      radioMinIcaMetros: m.radioMinIcaMetros,
      finalizacionRutas1: m.finalizacionRutas1,
      finalizacionRutas2: m.finalizacionRutas2,
      activarPorApp: m.activarPorApp,
      capturaPantalla: m.capturaPantalla,
      grabarPantalla: m.grabarPantalla,
      debugDelivery: m.debugDelivery,
      appPuedeDesactivar: m.appPuedeDesactivar,
      permiteBajaMomentanea: m.permiteBajaMomentanea,
      distanciaMaxMetros: m.distanciaMaxMetros,

      // Sub-dominios
      productos: m.stock.map((s) => ({
        id: s.id,
        productoEmpresa: s.productoEmpresa,
        productoCodigo: s.productoCodigo,
        stockMin: s.stockMovil,
        stockDps: s.stockOcupado,
        tiempoCarga: s.tiempoCarga,
        tiempoDescarga: s.tiempoDescarga,
      })),
      puntosRecarga: m.puntosRecarga.map((p) => ({
        id: p.id,
        puntoId: p.puntoId,
        nombre: p.nombre,
      })),
      servicios: m.servicios.map((sv) => ({
        id: sv.id,
        servicioId: sv.servicioId,
        nombre: sv.servicio?.nombre ?? null,
      })),
      escenarios: m.zonas.map((z) => ({
        id: z.id,
        escenarioId: z.escenarioId,
        canalId: z.canalId,
        zonaId: z.zonaId,
        tipo: z.tipo,
      })),
      bodega: m.bodega.map((b) => ({
        id: b.id,
        productoEmpresa: b.productoEmpresa,
        productoCodigo: b.productoCodigo,
        capacidad: b.capacidad,
        sinActivar: b.sinActivar,
      })),
      historico: [] as unknown[],
    };
  }

  async update(id: number, dto: UpdateMovilDto) {
    const existing = await this.prisma.movil.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Móvil ${id} no encontrado`);
    }

    const data: Prisma.MovilUpdateInput = {
      descripcion: dto.descripcion,
      matricula: dto.matricula,
      marca: dto.marca,
      modelo: dto.modelo,
      tipoServicio: dto.tipoServicio,
      servicioPrincipal: dto.servicioPrincipal,
      capacidadLote: dto.capacidadLote,
      observaciones: dto.observaciones,
      estadoCodigo: dto.estadoCodigo,
      pedidosPendientes: dto.pedidosPendientes,
      telefono: dto.telefono,
      dirSms: dto.dirSms,
      activoDesde: dto.activoDesde ? new Date(dto.activoDesde) : undefined,
      activoHasta: dto.activoHasta ? new Date(dto.activoHasta) : undefined,
      rutea: dto.rutea,
      enviarPedidosCelular: dto.enviarPedidosCelular,
      actualizarCoord30s: dto.actualizarCoord30s,
      usaIca: dto.usaIca,
      mostrarEnMapa: dto.mostrarEnMapa,
      reasignacionPuesto: dto.reasignacionPuesto,
      activarDireccionCalleId: dto.activarDireccionCalleId,
      activarDireccionNro: dto.activarDireccionNro,
      coordActivaX:
        dto.coordActivaX !== undefined ? new Prisma.Decimal(dto.coordActivaX) : undefined,
      coordActivaY:
        dto.coordActivaY !== undefined ? new Prisma.Decimal(dto.coordActivaY) : undefined,
      tiempoCumplimientoServicio: dto.tiempoCumplimientoServicio,
      finalizacionRutas1: dto.finalizacionRutas1,
      finalizacionRutas2: dto.finalizacionRutas2,
      radioMinIcaMetros: dto.radioMinIcaMetros,
      activarPorApp: dto.activarPorApp,
      appPuedeDesactivar: dto.appPuedeDesactivar,
      capturaPantalla: dto.capturaPantalla,
      grabarPantalla: dto.grabarPantalla,
      debugDelivery: dto.debugDelivery,
      permiteBajaMomentanea: dto.permiteBajaMomentanea,
      distanciaMaxMetros: dto.distanciaMaxMetros,
    };

    // fleteraId vía relación (connect/disconnect) para respetar la FK.
    if (dto.fleteraId !== undefined) {
      data.fletera = dto.fleteraId
        ? { connect: { id: dto.fleteraId } }
        : { disconnect: true };
    }

    await this.prisma.movil.update({ where: { id }, data });
    return this.findOne(id);
  }

  // Catálogos para los selects de la pantalla de detalle (además de /filtros).
  async catalogos() {
    const [estados, fleteras, servicios, calles] = await Promise.all([
      this.prisma.movilEstado.findMany({ orderBy: { codigo: 'asc' } }),
      this.prisma.empresaFletera.findMany({ orderBy: { nombre: 'asc' } }),
      this.prisma.servicio.findMany({ orderBy: { nombre: 'asc' } }),
      this.prisma.calle.findMany({
        where: { nombre: { not: null } },
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
    ]);

    const estadoSeen = new Set<string>();
    const estadosOut: { codigo: number; nombre: string }[] = [];
    for (const e of estados) {
      const nombre = e.nombre ?? '';
      if (!nombre || estadoSeen.has(nombre)) continue;
      estadoSeen.add(nombre);
      estadosOut.push({ codigo: e.codigo, nombre });
    }

    return {
      estados: estadosOut,
      fleteras: fleteras.map((f) => ({ id: f.id, nombre: f.nombre })),
      servicios: servicios.map((s) => ({ id: s.id, nombre: s.nombre })),
      calles: calles.map((c) => ({ id: c.id, nombre: c.nombre })),
    };
  }

  // Duplica config + sub-dominios. idOriginal placeholder = nuevo id (como clientes).
  async duplicar(id: number) {
    const src = await this.prisma.movil.findUnique({
      where: { id },
      include: {
        stock: true,
        puntosRecarga: true,
        servicios: true,
        zonas: true,
        bodega: true,
      },
    });
    if (!src) {
      throw new NotFoundException(`Móvil ${id} no encontrado`);
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.movil.create({
        data: {
          origen: 'capital',
          idOriginal: 0, // placeholder; se reescribe con el id nuevo
          fleteraId: src.fleteraId,
          puestoId: src.puestoId,
          estadoCodigo: src.estadoCodigo,
          descripcion: src.descripcion ? `${src.descripcion} (copia)` : 'Copia',
          marca: src.marca,
          modelo: src.modelo,
          matricula: null,
          telefono: src.telefono,
          capacidadLote: src.capacidadLote,
          servicioPrincipal: src.servicioPrincipal,
          tipoServicio: src.tipoServicio,
          rutea: src.rutea,
          enviarPedidosCelular: src.enviarPedidosCelular,
          reasignacionPuesto: src.reasignacionPuesto,
          activarDireccionCalleId: src.activarDireccionCalleId,
          activarDireccionNro: src.activarDireccionNro,
          coordActivaX: src.coordActivaX,
          coordActivaY: src.coordActivaY,
          tiempoCumplimientoServicio: src.tiempoCumplimientoServicio,
          dirSms: src.dirSms,
          usaIca: src.usaIca,
          mostrarEnMapa: src.mostrarEnMapa,
          actualizarCoord30s: src.actualizarCoord30s,
          radioMinIcaMetros: src.radioMinIcaMetros,
          finalizacionRutas1: src.finalizacionRutas1,
          finalizacionRutas2: src.finalizacionRutas2,
          activarPorApp: src.activarPorApp,
          capturaPantalla: src.capturaPantalla,
          grabarPantalla: src.grabarPantalla,
          debugDelivery: src.debugDelivery,
          appPuedeDesactivar: src.appPuedeDesactivar,
          permiteBajaMomentanea: src.permiteBajaMomentanea,
          distanciaMaxMetros: src.distanciaMaxMetros,
        },
      });

      const updated = await tx.movil.update({
        where: { id: created.id },
        data: { idOriginal: created.id },
      });

      if (src.stock.length) {
        await tx.movilStock.createMany({
          data: src.stock.map((s) => ({
            movilId: updated.id,
            origen: 'capital',
            productoEmpresa: s.productoEmpresa,
            productoCodigo: s.productoCodigo,
            stockMovil: s.stockMovil,
            stockOcupado: s.stockOcupado,
            tiempoCarga: s.tiempoCarga,
            tiempoDescarga: s.tiempoDescarga,
          })),
        });
      }
      if (src.puntosRecarga.length) {
        await tx.movilPuntoRecarga.createMany({
          data: src.puntosRecarga.map((p) => ({
            movilId: updated.id,
            origen: 'capital',
            puntoId: p.puntoId,
            nombre: p.nombre,
          })),
        });
      }
      if (src.servicios.length) {
        await tx.movilServicio.createMany({
          data: src.servicios.map((sv) => ({
            movilId: updated.id,
            origen: 'capital',
            servicioId: sv.servicioId,
          })),
        });
      }
      if (src.zonas.length) {
        await tx.movilZona.createMany({
          data: src.zonas.map((z) => ({
            movilId: updated.id,
            origen: 'capital',
            escenarioId: z.escenarioId,
            canalId: z.canalId,
            zonaId: z.zonaId,
            tipo: z.tipo,
            flag: z.flag,
          })),
        });
      }
      if (src.bodega.length) {
        await tx.movilBodega.createMany({
          data: src.bodega.map((b) => ({
            movilId: updated.id,
            origen: 'capital',
            productoEmpresa: b.productoEmpresa,
            productoCodigo: b.productoCodigo,
            capacidad: b.capacidad,
            sinActivar: b.sinActivar,
          })),
        });
      }

      return { id: updated.id };
    });
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
