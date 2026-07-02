import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateZonaDto } from './dto/create-zona.dto';
import { UpdateZonaDto } from './dto/update-zona.dto';
import { QueryZonasDto } from './dto/query-zonas.dto';
import { TrackSyncService, TrackZona } from './track-sync.service';

interface Punto {
  lat: number;
  lng: number;
}

export interface ZonaOut {
  id: number;
  code: string;
  puestoId: number;
  name: string;
  description: string | null;
  color: string;
  zoneType: string;
  services: string[];
  status: string;
  polygon: Punto[];
  trackZonaId: number | null;
  syncEstado: string;
  syncError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Rango razonable de coordenadas para Uruguay (sanea lat/lng invertidas,
// ej. CANELONES viene con lat=-56.29 lng=-34.52 en la tabla puesto).
function sanitizeCoord(
  lat: number | null,
  lng: number | null,
): { lat: number | null; lng: number | null } {
  if (lat === null || lng === null) return { lat: null, lng: null };
  const latOk = (v: number) => v >= -36 && v <= -29;
  const lngOk = (v: number) => v >= -59 && v <= -52;
  if (latOk(lat) && lngOk(lng)) return { lat, lng };
  if (latOk(lng) && lngOk(lat)) return { lat: lng, lng: lat }; // invertidas
  return { lat: null, lng: null };
}

@Injectable()
export class ZonasService {
  private readonly logger = new Logger(ZonasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly track: TrackSyncService,
  ) {}

  // ─── Presentación ───────────────────────────────────────────────────────────

  private toOut(z: {
    id: number;
    puestoId: number;
    nombre: string;
    descripcion: string | null;
    color: string;
    tipoZona: string;
    servicios: string[];
    estado: string;
    poligono: Prisma.JsonValue;
    trackZonaId: number | null;
    syncEstado: string;
    syncError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ZonaOut {
    return {
      id: z.id,
      code: `Z-${String(z.id).padStart(3, '0')}`,
      puestoId: z.puestoId,
      name: z.nombre,
      description: z.descripcion,
      color: z.color,
      zoneType: z.tipoZona,
      services: z.servicios,
      status: z.estado,
      polygon: (z.poligono as unknown as Punto[]) ?? [],
      trackZonaId: z.trackZonaId,
      syncEstado: z.syncEstado,
      syncError: z.syncError,
      createdAt: z.createdAt,
      updatedAt: z.updatedAt,
    };
  }

  // ─── Consultas ──────────────────────────────────────────────────────────────

  async findAll(q: QueryZonasDto): Promise<ZonaOut[]> {
    const where: Prisma.ZonaOperativaWhereInput = {};
    if (q.puestoId !== undefined) where.puestoId = q.puestoId;
    if (q.incluirArchivadas === 'false') where.estado = 'ACTIVE';
    if (q.tipoZona) where.tipoZona = q.tipoZona;
    if (q.servicio) where.servicios = { has: q.servicio };
    if (q.search) {
      where.nombre = { contains: q.search.trim(), mode: 'insensitive' };
    }
    const rows = await this.prisma.zonaOperativa.findMany({
      where,
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => this.toOut(r));
  }

  async puestos() {
    const rows = await this.prisma.puesto.findMany({
      where: { estado: 'A' },
      select: { id: true, nombre: true, lat: true, lng: true },
      orderBy: { nombre: 'asc' },
    });
    const mapeos = await this.prisma.puestoEscenario.findMany();
    const escenarioPorPuesto = new Map(mapeos.map((m) => [m.puestoId, m.escenarioId]));
    return rows.map((p) => {
      const { lat, lng } = sanitizeCoord(
        p.lat ? Number(p.lat) : null,
        p.lng ? Number(p.lng) : null,
      );
      return {
        id: p.id,
        name: p.nombre ?? `Puesto ${p.id}`,
        lat,
        lng,
        escenarioId: escenarioPorPuesto.get(p.id) ?? null,
      };
    });
  }

  private async findRow(id: number) {
    const row = await this.prisma.zonaOperativa.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Zona ${id} no encontrada`);
    return row;
  }

  // ─── Mutaciones (commit local primero, espejo best-effort después) ──────────

  async create(dto: CreateZonaDto): Promise<ZonaOut> {
    const row = await this.prisma.zonaOperativa.create({
      data: {
        puestoId: dto.puestoId,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        color: dto.color,
        tipoZona: dto.tipoZona,
        servicios: dto.servicios,
        estado: dto.estado ?? 'ACTIVE',
        poligono: dto.poligono as unknown as Prisma.InputJsonValue,
        syncEstado: 'PENDING',
      },
    });
    const synced = await this.pushToTrack(row.id);
    return this.toOut(synced);
  }

  async update(id: number, dto: UpdateZonaDto): Promise<ZonaOut> {
    await this.findRow(id);
    await this.prisma.zonaOperativa.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        descripcion: dto.descripcion,
        color: dto.color,
        tipoZona: dto.tipoZona,
        servicios: dto.servicios,
        estado: dto.estado,
        poligono: dto.poligono
          ? (dto.poligono as unknown as Prisma.InputJsonValue)
          : undefined,
        syncEstado: 'PENDING',
        syncError: null,
      },
    });
    const synced = await this.pushToTrack(id);
    return this.toOut(synced);
  }

  async duplicar(id: number): Promise<ZonaOut> {
    const src = await this.findRow(id);
    const poligono = ((src.poligono as unknown as Punto[]) ?? []).map((p) => ({
      lat: p.lat + 0.006,
      lng: p.lng + 0.006,
    }));
    return this.create({
      puestoId: src.puestoId,
      nombre: `${src.nombre} (copia)`.slice(0, 60),
      descripcion: src.descripcion ?? undefined,
      color: src.color,
      tipoZona: src.tipoZona,
      servicios: src.servicios,
      estado: 'ACTIVE',
      poligono,
    });
  }

  async remove(id: number): Promise<{ trackDeleted: boolean | null }> {
    const row = await this.findRow(id);
    await this.prisma.zonaOperativa.delete({ where: { id } });

    // Espejo: borrar también en track (decisión 2026-07-02).
    if (row.trackZonaId && this.track.enabled) {
      try {
        await this.track.deleteZona(row.trackZonaId);
        return { trackDeleted: true };
      } catch (err) {
        this.logger.error(
          `Zona ${id} borrada en goya pero NO en track (zona_id ${row.trackZonaId}): ${(err as Error).message}`,
        );
        return { trackDeleted: false };
      }
    }
    return { trackDeleted: null }; // no estaba espejada
  }

  // ─── Espejo saliente ────────────────────────────────────────────────────────

  /**
   * Empuja una zona a track. Nunca lanza: deja el resultado en
   * syncEstado/syncError y devuelve la fila actualizada.
   */
  private async pushToTrack(id: number) {
    const row = await this.findRow(id);

    const mapeo = await this.prisma.puestoEscenario.findUnique({
      where: { puestoId: row.puestoId },
    });
    if (!mapeo) {
      // Puesto sin escenario en track: la zona vive solo en goya.
      return this.prisma.zonaOperativa.update({
        where: { id },
        data: { syncEstado: 'NA', syncError: null },
      });
    }
    if (!this.track.enabled) {
      return this.prisma.zonaOperativa.update({
        where: { id },
        data: { syncEstado: 'PENDING', syncError: 'TRACK_API_URL/KEY sin configurar' },
      });
    }

    try {
      const trackZonaId = row.trackZonaId ?? (await this.track.nextZonaId());
      const poligono = (row.poligono as unknown as Punto[]) ?? [];
      await this.track.upsertZona({
        zona_id: trackZonaId,
        escenario_id: mapeo.escenarioId,
        nombre: row.nombre,
        descripcion: row.descripcion,
        color: row.color,
        activa: row.estado === 'ACTIVE',
        // mismo formato que usa track: valores como string
        geojson: JSON.stringify(
          poligono.map((p) => ({ lng: String(p.lng), lat: String(p.lat) })),
        ),
      });
      return await this.prisma.zonaOperativa.update({
        where: { id },
        data: {
          trackZonaId,
          syncEstado: 'SYNCED',
          syncedAt: new Date(),
          syncError: null,
        },
      });
    } catch (err) {
      const msg = (err as Error).message.slice(0, 300);
      this.logger.error(`Sync a track falló para zona ${id}: ${msg}`);
      return await this.prisma.zonaOperativa.update({
        where: { id },
        data: { syncEstado: 'ERROR', syncError: msg },
      });
    }
  }

  /** Reintenta el espejo de todas las zonas PENDING/ERROR. */
  async syncPush() {
    const pendientes = await this.prisma.zonaOperativa.findMany({
      where: { syncEstado: { in: ['PENDING', 'ERROR'] } },
      select: { id: true },
    });
    let ok = 0;
    let error = 0;
    for (const { id } of pendientes) {
      const r = await this.pushToTrack(id);
      if (r.syncEstado === 'SYNCED' || r.syncEstado === 'NA') ok += 1;
      else error += 1;
    }
    return { procesadas: pendientes.length, ok, error };
  }

  // ─── Espejo entrante (pull / webhook) ───────────────────────────────────────

  private parseTrackGeojson(geojson: string | null): Punto[] {
    if (!geojson) return [];
    try {
      const raw = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
      if (!Array.isArray(raw)) return [];
      return raw
        .map((p: { lat: unknown; lng: unknown }) => ({
          lat: Number(p.lat),
          lng: Number(p.lng),
        }))
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    } catch {
      return [];
    }
  }

  /** Upsertea en goya una zona con shape de track. Devuelve el resultado. */
  private async upsertFromTrack(
    tz: TrackZona,
    puestoPorEscenario: Map<number, number>,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const puestoId = tz.escenario_id != null ? puestoPorEscenario.get(tz.escenario_id) : undefined;
    if (puestoId === undefined) return 'skipped'; // escenario sin mapeo

    const poligono = this.parseTrackGeojson(tz.geojson);
    if (poligono.length < 3) return 'skipped';

    const data = {
      puestoId,
      nombre: (tz.nombre ?? `Zona ${tz.zona_id}`).slice(0, 60),
      descripcion: tz.descripcion?.slice(0, 200) ?? null,
      color: tz.color && /^#[0-9a-fA-F]{6}$/.test(tz.color) ? tz.color : '#64748B',
      estado: tz.activa === false ? 'ARCHIVED' : 'ACTIVE',
      poligono: poligono as unknown as Prisma.InputJsonValue,
      syncEstado: 'SYNCED',
      syncedAt: new Date(),
      syncError: null,
    };

    const existing = await this.prisma.zonaOperativa.findUnique({
      where: { trackZonaId: tz.zona_id },
    });
    if (existing) {
      await this.prisma.zonaOperativa.update({
        where: { id: existing.id },
        data, // tipoZona/servicios no se tocan: son solo-goya
      });
      return 'updated';
    }
    await this.prisma.zonaOperativa.create({
      data: {
        ...data,
        trackZonaId: tz.zona_id,
        tipoZona: 'DISTRIBUCION', // default para zonas que nacen en track
        servicios: [],
      },
    });
    return 'created';
  }

  /** Importa/actualiza TODAS las zonas de track (carga inicial y re-sync). */
  async syncPull() {
    if (!this.track.enabled) {
      return { error: 'TRACK_API_URL/TRACK_API_KEY sin configurar' };
    }
    const mapeos = await this.prisma.puestoEscenario.findMany();
    const puestoPorEscenario = new Map<number, number>();
    for (const m of mapeos) {
      // si dos puestos comparten escenario, gana el primero
      if (!puestoPorEscenario.has(m.escenarioId)) {
        puestoPorEscenario.set(m.escenarioId, m.puestoId);
      }
    }

    const zonas = await this.track.getZonas();
    let created = 0;
    let updated = 0;
    const skipped: number[] = [];
    for (const tz of zonas) {
      const r = await this.upsertFromTrack(tz, puestoPorEscenario);
      if (r === 'created') created += 1;
      else if (r === 'updated') updated += 1;
      else skipped.push(tz.zona_id);
    }
    this.logger.log(
      `Pull de track: ${zonas.length} zonas → ${created} creadas, ${updated} actualizadas, ${skipped.length} salteadas`,
    );
    return { total: zonas.length, created, updated, skipped };
  }

  /** Webhook: track empuja una o varias zonas (shape de track). */
  async syncWebhook(body: { zonas?: TrackZona[] } | TrackZona) {
    const zonas: TrackZona[] = Array.isArray((body as { zonas?: TrackZona[] }).zonas)
      ? ((body as { zonas: TrackZona[] }).zonas)
      : [body as TrackZona];

    const mapeos = await this.prisma.puestoEscenario.findMany();
    const puestoPorEscenario = new Map<number, number>();
    for (const m of mapeos) {
      if (!puestoPorEscenario.has(m.escenarioId)) {
        puestoPorEscenario.set(m.escenarioId, m.puestoId);
      }
    }

    let created = 0;
    let updated = 0;
    const skipped: number[] = [];
    for (const tz of zonas) {
      if (typeof tz?.zona_id !== 'number') continue;
      const r = await this.upsertFromTrack(tz, puestoPorEscenario);
      if (r === 'created') created += 1;
      else if (r === 'updated') updated += 1;
      else skipped.push(tz.zona_id);
    }
    return { recibidas: zonas.length, created, updated, skipped };
  }
}
