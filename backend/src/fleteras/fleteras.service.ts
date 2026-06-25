import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryFleterasDto } from './dto/query-fleteras.dto';

// ─── Tipos de respuesta ───────────────────────────────────────────────────────

export interface FleteraListItem {
  id: number;
  idOriginal: number;
  puestoId: number | null;
  puestoNombre: string | null;
  nombre: string | null;
  telefono: string | null;
  calle: string | null;
  estado: string | null;
  cantMoviles: number;
  activos: number;
  ultimaFecha: Date | null;
  origen: string;
}

@Injectable()
export class FleterasService {
  constructor(private readonly prisma: PrismaService) {}

  // Catálogo puesto (id→nombre) en memoria (no es relación Prisma de fletera).
  private async loadPuestoMap(): Promise<Map<number, string | null>> {
    const puestos = await this.prisma.puesto.findMany({
      select: { id: true, nombre: true },
    });
    const map = new Map<number, string | null>();
    for (const p of puestos) map.set(p.id, p.nombre);
    return map;
  }

  // Pares (origen, codigo) de estados "activos" = nombre empieza con "ACTIVO".
  private async loadEstadosActivos(): Promise<
    { origen: string; estadoCodigo: number }[]
  > {
    const estados = await this.prisma.movilEstado.findMany();
    return estados
      .filter((e) => (e.nombre ?? '').toUpperCase().startsWith('ACTIVO'))
      .map((e) => ({ origen: e.origen, estadoCodigo: e.codigo }));
  }

  private buildWhere(q: QueryFleterasDto): Prisma.EmpresaFleteraWhereInput {
    const where: Prisma.EmpresaFleteraWhereInput = {};
    if (q.estado) where.estado = q.estado;
    if (q.puestoId !== undefined) where.puestoId = q.puestoId;
    if (q.search) {
      where.nombre = { contains: q.search.trim(), mode: 'insensitive' };
    }
    return where;
  }

  async findAll(q: QueryFleterasDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const where = this.buildWhere(q);

    const activos = await this.loadEstadosActivos();
    const algunActivo = { OR: activos.map((a) => ({ ...a })) };

    // Filtro conMoviles (some/none sobre la relación moviles).
    if (q.conMoviles === 'con-activos') {
      where.moviles = activos.length ? { some: { OR: activos } } : { none: {} };
    } else if (q.conMoviles === 'sin-activos') {
      // tiene móviles pero ninguno activo
      where.AND = [
        { moviles: { some: {} } },
        activos.length
          ? { moviles: { none: { OR: activos } } }
          : { moviles: { some: {} } },
      ];
    } else if (q.conMoviles === 'sin') {
      where.moviles = { none: {} };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.empresaFletera.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.empresaFletera.count({ where }),
    ]);

    const fleteraIds = rows.map((r) => r.id);

    // Agregaciones SIN N+1: total de móviles + activos por fleteraId.
    const [totalGroup, activosGroup, puestoMap] = await Promise.all([
      fleteraIds.length
        ? this.prisma.movil.groupBy({
            by: ['fleteraId'],
            where: { fleteraId: { in: fleteraIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      fleteraIds.length && activos.length
        ? this.prisma.movil.groupBy({
            by: ['fleteraId'],
            where: { fleteraId: { in: fleteraIds }, ...algunActivo },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      this.loadPuestoMap(),
    ]);

    const totalByFletera = new Map<number, number>();
    for (const g of totalGroup) {
      if (g.fleteraId != null) totalByFletera.set(g.fleteraId, g._count._all);
    }
    const activosByFletera = new Map<number, number>();
    for (const g of activosGroup) {
      if (g.fleteraId != null) activosByFletera.set(g.fleteraId, g._count._all);
    }

    const data: FleteraListItem[] = rows.map((f) => ({
      id: f.id,
      idOriginal: f.idOriginal,
      puestoId: f.puestoId,
      puestoNombre: f.puestoId != null ? puestoMap.get(f.puestoId) ?? null : null,
      nombre: f.nombre,
      telefono: f.telefono,
      calle: f.direccion,
      estado: f.estado,
      cantMoviles: totalByFletera.get(f.id) ?? 0,
      activos: activosByFletera.get(f.id) ?? 0,
      ultimaFecha: f.updatedAt,
      origen: f.origen,
    }));

    return { data, total, page, pageSize };
  }

  async kpis() {
    const [total, activas, movilesAsociados, puestosDistinct] =
      await this.prisma.$transaction([
        this.prisma.empresaFletera.count(),
        this.prisma.empresaFletera.count({ where: { estado: 'A' } }),
        this.prisma.movil.count({ where: { fleteraId: { not: null } } }),
        this.prisma.empresaFletera.findMany({
          where: { puestoId: { not: null } },
          distinct: ['puestoId'],
          select: { puestoId: true },
        }),
      ]);

    return {
      total,
      activas,
      movilesAsociados,
      puestosCubiertos: puestosDistinct.length,
    };
  }

  async filtros() {
    const puestoMap = await this.loadPuestoMap();
    const usados = await this.prisma.empresaFletera.findMany({
      where: { puestoId: { not: null } },
      distinct: ['puestoId'],
      select: { puestoId: true },
    });

    const puestos = usados
      .map((u) => u.puestoId!)
      .map((id) => ({ id, nombre: puestoMap.get(id) ?? `#${id}` }))
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? ''));

    return {
      estados: [
        { value: 'A', label: 'Activo' },
        { value: 'P', label: 'Pasivo' },
        { value: 'I', label: 'Inactivo' },
      ],
      puestos,
    };
  }

  async findOne(id: number) {
    const f = await this.prisma.empresaFletera.findUnique({
      where: { id },
      include: {
        moviles: {
          orderBy: { idOriginal: 'asc' },
          select: {
            id: true,
            idOriginal: true,
            numeroMovil: true,
            descripcion: true,
            estadoCodigo: true,
            origen: true,
          },
        },
      },
    });
    if (!f) {
      throw new NotFoundException(`Empresa fletera ${id} no encontrada`);
    }

    const puestoMap = await this.loadPuestoMap();
    const activos = await this.loadEstadosActivos();
    const activoSet = new Set(
      activos.map((a) => `${a.origen}:${a.estadoCodigo}`),
    );

    const moviles = f.moviles.map((m) => ({
      id: m.id,
      numero: m.numeroMovil ?? m.idOriginal,
      conductor: m.descripcion,
      activo: activoSet.has(`${m.origen}:${m.estadoCodigo}`),
    }));
    const movilesActivos = moviles.filter((m) => m.activo).length;
    const movilesNoActivos = moviles.length - movilesActivos;

    // Zonas del puesto de la empresa (catálogo zona where puestoId).
    let zonas: string[] = [];
    if (f.puestoId != null) {
      const zonaRows = await this.prisma.zona.findMany({
        where: { puestoId: f.puestoId, nombre: { not: null } },
        select: { nombre: true },
        orderBy: { nombre: 'asc' },
      });
      zonas = zonaRows.map((z) => z.nombre!).filter(Boolean);
    }

    return {
      id: f.id,
      origen: f.origen,
      idOriginal: f.idOriginal,
      puestoId: f.puestoId,
      puestoNombre: f.puestoId != null ? puestoMap.get(f.puestoId) ?? null : null,
      nombre: f.nombre,
      nombreComercial: f.nombreComercial,
      razonSocial: f.razonSocial,
      ruc: f.ruc,
      telefono: f.telefono,
      email: f.email,
      calle: f.direccion,
      baseOperativa: f.baseOperativa,
      estado: f.estado,
      observaciones: f.observaciones,
      ultimaFecha: f.updatedAt,
      movilesActivos,
      movilesNoActivos,
      moviles,
      zonas,
      pedidosPendientes: null as number | null,
    };
  }
}
