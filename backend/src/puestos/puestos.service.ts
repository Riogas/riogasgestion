import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryPuestosDto } from './dto/query-puestos.dto';
import { CreatePuestoDto, UpdatePuestoDto } from './dto/upsert-puesto.dto';

/**
 * `puesto.zonaId` usa 0 como "sin zona" (sentinela del AS400), no NULL. Sin
 * esto, 13 de los 19 puestos aparecerían con una zona que no existe.
 */
const SIN_ZONA = 0;

/** Estados vigentes en la tabla: A=Activo, P=Pasivo. */
const ESTADO_ACTIVO = 'A';

type PuestoRow = Prisma.PuestoGetPayload<object>;

/** Lo que la UI necesita por fila, ya cruzado con las tablas relacionadas. */
export interface PuestoListItem extends PuestoRow {
  departamentoNombre: string | null;
  localidadNombre: string | null;
  zonaNombre: string | null;
  zonasOperativas: number;
  moviles: number;
}

@Injectable()
export class PuestosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Conteos por puesto que no se pueden resolver con un include de Prisma:
   * ni `movil` ni `zona_operativa` tienen relación declarada contra `puesto`
   * (la base no tiene FKs hacia esa tabla), así que se agrupan aparte y se
   * cruzan en memoria. Son 19 puestos: el costo es irrelevante y evita N+1.
   */
  private async conteos() {
    const [moviles, zonas] = await Promise.all([
      this.prisma.movil.groupBy({
        by: ['puestoId'],
        _count: { _all: true },
        where: { puestoId: { not: null } },
      }),
      this.prisma.zonaOperativa.groupBy({
        by: ['puestoId'],
        _count: { _all: true },
        where: { estado: 'ACTIVE' },
      }),
    ]);

    return {
      moviles: new Map(moviles.map((m) => [m.puestoId as number, m._count._all])),
      zonas: new Map(zonas.map((z) => [z.puestoId, z._count._all])),
    };
  }

  /** Nombres de departamento, localidad y zona legacy, indexados por id. */
  private async catalogos() {
    const [departamentos, localidades, zonas] = await Promise.all([
      this.prisma.departamento.findMany({ select: { id: true, nombre: true } }),
      this.prisma.localidad.findMany({ select: { id: true, nombre: true } }),
      this.prisma.zona.findMany({ select: { id: true, nombre: true } }),
    ]);
    return {
      departamentos: new Map(departamentos.map((d) => [d.id, d.nombre])),
      localidades: new Map(localidades.map((l) => [l.id, l.nombre])),
      zonas: new Map(zonas.map((z) => [z.id, z.nombre])),
    };
  }

  private decorar(
    puestos: PuestoRow[],
    cat: Awaited<ReturnType<PuestosService['catalogos']>>,
    cnt: Awaited<ReturnType<PuestosService['conteos']>>,
  ): PuestoListItem[] {
    return puestos.map((p) => ({
      ...p,
      departamentoNombre: p.departamentoId
        ? (cat.departamentos.get(p.departamentoId) ?? null)
        : null,
      localidadNombre: p.localidadId ? (cat.localidades.get(p.localidadId) ?? null) : null,
      zonaNombre:
        p.zonaId && p.zonaId !== SIN_ZONA ? (cat.zonas.get(p.zonaId) ?? null) : null,
      zonasOperativas: cnt.zonas.get(p.id) ?? 0,
      moviles: cnt.moviles.get(p.id) ?? 0,
    }));
  }

  async findAll(query: QueryPuestosDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 10, 100);

    const where: Prisma.PuestoWhereInput = {};
    if (query.estado) where.estado = query.estado;
    if (query.departamentoId) where.departamentoId = query.departamentoId;

    // La búsqueda libre incluye el id: escribir "100" tiene que encontrar el
    // puesto 100, no solo los nombres que contengan "100".
    if (query.search?.trim()) {
      const q = query.search.trim();
      const comoId = Number(q);
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { direccion: { contains: q, mode: 'insensitive' } },
        ...(Number.isInteger(comoId) ? [{ id: comoId }] : []),
      ];
    }

    // Los filtros "con/sin zona" y "con/sin móviles" dependen de conteos de
    // otras tablas, así que se resuelven sobre el set ya decorado.
    const [todos, cat, cnt] = await Promise.all([
      this.prisma.puesto.findMany({ where, orderBy: [{ nombre: 'asc' }, { id: 'asc' }] }),
      this.catalogos(),
      this.conteos(),
    ]);

    let items = this.decorar(todos, cat, cnt);

    // El departamento también se busca por nombre, que vive en otra tabla.
    if (query.search?.trim()) {
      const q = query.search.trim().toLowerCase();
      const yaMatchea = (p: PuestoListItem) =>
        String(p.id) === q ||
        (p.nombre ?? '').toLowerCase().includes(q) ||
        (p.direccion ?? '').toLowerCase().includes(q);
      items = items.filter(
        (p) => yaMatchea(p) || (p.departamentoNombre ?? '').toLowerCase().includes(q),
      );
    }

    if (query.conZona === 'con') items = items.filter((p) => p.zonasOperativas > 0);
    if (query.conZona === 'sin') items = items.filter((p) => p.zonasOperativas === 0);
    if (query.conMoviles === 'con') items = items.filter((p) => p.moviles > 0);
    if (query.conMoviles === 'sin') items = items.filter((p) => p.moviles === 0);

    const total = items.length;
    const desde = (page - 1) * pageSize;

    return {
      items: items.slice(desde, desde + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  /** Métricas de las cards superiores. Siempre sobre el total, sin filtros. */
  async kpis() {
    const [puestos, cnt] = await Promise.all([
      this.prisma.puesto.findMany({ select: { id: true, estado: true } }),
      this.conteos(),
    ]);

    const total = puestos.length;
    const activos = puestos.filter((p) => p.estado === ESTADO_ACTIVO).length;
    const conZona = puestos.filter((p) => (cnt.zonas.get(p.id) ?? 0) > 0).length;
    const conMoviles = puestos.filter((p) => (cnt.moviles.get(p.id) ?? 0) > 0).length;

    const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 1000) / 10);

    return {
      total,
      activos,
      conZona,
      conMoviles,
      pctActivos: pct(activos),
      pctConZona: pct(conZona),
      pctConMoviles: pct(conMoviles),
    };
  }

  /** Opciones de los selects de la barra de filtros. */
  async filtros() {
    const [departamentos, usados] = await Promise.all([
      this.prisma.departamento.findMany({
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.puesto.findMany({ select: { departamentoId: true }, distinct: ['departamentoId'] }),
    ]);

    const enUso = new Set(usados.map((u) => u.departamentoId).filter((d): d is number => d !== null));

    return {
      // Se devuelven todos los departamentos, marcando cuáles tienen puestos:
      // hoy solo 1 de 19 puestos tiene departamento cargado, así que filtrar
      // por "en uso" dejaría el select prácticamente vacío.
      departamentos: departamentos.map((d) => ({ ...d, enUso: enUso.has(d.id) })),
    };
  }

  async findOne(id: number) {
    const puesto = await this.prisma.puesto.findUnique({ where: { id } });
    if (!puesto) throw new NotFoundException(`No existe el puesto ${id}`);

    const [cat, cnt, zonasOperativas, moviles] = await Promise.all([
      this.catalogos(),
      this.conteos(),
      this.prisma.zonaOperativa.findMany({
        where: { puestoId: id, estado: 'ACTIVE' },
        select: {
          id: true, nombre: true, descripcion: true, color: true,
          tipoZona: true, servicios: true, estado: true, updatedAt: true,
        },
        orderBy: { nombre: 'asc' },
      }),
      this.prisma.movil.findMany({
        where: { puestoId: id },
        select: {
          id: true, numeroMovil: true, descripcion: true, matricula: true,
          estadoCodigo: true, ultimaPosicionAt: true, tieneGps: true,
        },
        orderBy: [{ numeroMovil: 'asc' }, { id: 'asc' }],
        take: 50,
      }),
    ]);

    const [decorado] = this.decorar([puesto], cat, cnt);
    return { ...decorado, zonasOperativas: zonasOperativas.length, zonas: zonasOperativas, movilesLista: moviles };
  }

  async create(dto: CreatePuestoDto) {
    const existe = await this.prisma.puesto.findUnique({ where: { id: dto.id } });
    if (existe) {
      throw new ConflictException(`Ya existe un puesto con el id ${dto.id}`);
    }
    this.validarCoordenadas(dto.lat, dto.lng);

    return this.prisma.puesto.create({
      data: {
        ...dto,
        estado: dto.estado ?? ESTADO_ACTIVO,
        lat: dto.lat != null ? new Prisma.Decimal(dto.lat) : null,
        lng: dto.lng != null ? new Prisma.Decimal(dto.lng) : null,
      },
    });
  }

  async update(id: number, dto: UpdatePuestoDto) {
    const existe = await this.prisma.puesto.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException(`No existe el puesto ${id}`);

    // Se contrastan contra el valor final, no solo contra el payload: mandar
    // solo `lat` en un puesto sin `lng` dejaría la coordenada a medias.
    const latFinal = dto.lat !== undefined ? dto.lat : existe.lat?.toNumber() ?? null;
    const lngFinal = dto.lng !== undefined ? dto.lng : existe.lng?.toNumber() ?? null;
    this.validarCoordenadas(latFinal, lngFinal);

    return this.prisma.puesto.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.lat !== undefined
          ? { lat: dto.lat != null ? new Prisma.Decimal(dto.lat) : null }
          : {}),
        ...(dto.lng !== undefined
          ? { lng: dto.lng != null ? new Prisma.Decimal(dto.lng) : null }
          : {}),
      },
    });
  }

  private validarCoordenadas(lat?: number | null, lng?: number | null) {
    const tieneLat = lat !== undefined && lat !== null;
    const tieneLng = lng !== undefined && lng !== null;
    if (tieneLat !== tieneLng) {
      throw new BadRequestException(
        'Latitud y longitud van juntas: cargá las dos o ninguna.',
      );
    }
  }
}
