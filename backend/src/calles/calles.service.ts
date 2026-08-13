import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { claveEsencial, normalizarCalle, normalizarLugar, sinTipoVia } from './normalizar';

/** Un ítem del suggest: una calle, venga de donde venga. */
export interface CalleSugerida {
  /** 'osm' | 'nomenclator' — de qué catálogo salió. */
  fuente: string;
  nombre: string;
  departamento: string | null;
  localidad: string | null;
  /** El id del nomenclator, listo para guardar en cliente/pedido. */
  calid: number | null;
  /** Estado del match cuando la fila es OSM: AUTO_CONFIRMADO, A_REVISAR, etc. */
  matchEstado: string | null;
  calleOsmId: number | null;
  clientes: number;
  variantes: string[];
}

interface Indexado extends CalleSugerida {
  claves: string[]; // formas normalizadas por las que se puede encontrar
  deptoNorm: string;
  locNorm: string | null;
}

const PRIORIDAD_ESTADO: Record<string, number> = {
  CONFIRMADO_MANUAL: 3,
  AUTO_CONFIRMADO: 2,
  A_REVISAR: 1,
};

@Injectable()
export class CallesService implements OnModuleInit {
  private readonly logger = new Logger(CallesService.name);
  private indice: Indexado[] = [];
  private cargadoEn = 0;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.recargar().catch((e) =>
      this.logger.error(`No se pudo cargar el índice de calles: ${e.message}`),
    );
    // Refresco periódico: el matching y la pantalla de revisión cambian los
    // CALID resueltos; 10 minutos de staleness es aceptable para un suggest.
    const timer = setInterval(() => void this.recargar().catch(() => undefined), 600_000);
    timer.unref();
  }

  async recargar(): Promise<{ calles: number }> {
    const t0 = Date.now();

    const [osm, matches, nomenclator, ciudades, deptos] = await Promise.all([
      this.prisma.calleOsm.findMany({ where: { activo: true } }),
      this.prisma.calleMatch.findMany({ where: { estado: { not: 'RECHAZADO' } } }),
      this.prisma.calle.findMany({ where: { nombre: { not: null } } }),
      this.prisma.ciudadNomenclator.findMany(),
      this.prisma.deptoNomenclator.findMany(),
    ]);

    const ciudadPorId = new Map(ciudades.map((c) => [c.id, c]));
    const deptoPorId = new Map(deptos.map((d) => [d.id, d]));

    // Mejor match por calle OSM (para colgarle el CALID al ítem del suggest).
    const mejorMatch = new Map<number, (typeof matches)[number]>();
    for (const m of matches) {
      const previo = mejorMatch.get(m.calleOsmId);
      if (
        !previo ||
        (PRIORIDAD_ESTADO[m.estado] ?? 0) > (PRIORIDAD_ESTADO[previo.estado] ?? 0) ||
        ((PRIORIDAD_ESTADO[m.estado] ?? 0) === (PRIORIDAD_ESTADO[previo.estado] ?? 0) &&
          Number(m.score) > Number(previo.score))
      ) {
        mejorMatch.set(m.calleOsmId, m);
      }
    }
    const calidsEnlazados = new Set(
      [...mejorMatch.values()]
        .filter((m) => m.estado !== 'A_REVISAR')
        .map((m) => m.calleId),
    );
    const clientesPorCalid = new Map(nomenclator.map((c) => [c.id, c.cantClientesReal ?? 0]));

    const indice: Indexado[] = [];

    for (const o of osm) {
      const m = mejorMatch.get(o.id);
      const variantes = Array.isArray(o.variantes)
        ? (o.variantes as { nombre?: string }[]).map((v) => v.nombre ?? '').filter(Boolean)
        : [];
      const claves = new Set<string>([
        o.nombreNorm,
        sinTipoVia(o.nombreNorm),
        claveEsencial(o.nombreNorm),
      ]);
      for (const v of variantes) {
        const n = normalizarCalle(v);
        if (n) {
          claves.add(n);
          claves.add(sinTipoVia(n));
          claves.add(claveEsencial(n));
        }
      }
      indice.push({
        fuente: 'osm',
        nombre: o.nombre,
        departamento: o.departamento,
        localidad: o.localidad,
        calid: m ? m.calleId : null,
        matchEstado: m ? m.estado : null,
        calleOsmId: o.id,
        clientes: m ? (clientesPorCalid.get(m.calleId) ?? 0) : 0,
        variantes,
        claves: [...claves],
        deptoNorm: normalizarLugar(o.departamento),
        locNorm: o.localidadNorm,
      });
    }

    // Calles del nomenclator SIN calle OSM enlazada: entran igual al suggest.
    // Si no, el método nuevo no puede atender a los clientes de esas calles
    // (caminos rurales que OSM no tiene) y la convivencia se cae de entrada.
    for (const c of nomenclator) {
      if (calidsEnlazados.has(c.id) || !c.nombre) continue;
      const norm = normalizarCalle(c.nombre);
      if (!norm || norm === 'SIN NOMBRE') continue;
      const ciudad = c.ciudadId ? ciudadPorId.get(c.ciudadId) : undefined;
      const depto = c.deptoId ? deptoPorId.get(c.deptoId) : undefined;
      const claves = new Set<string>([norm, sinTipoVia(norm), claveEsencial(norm)]);
      if (c.exNombre) {
        const ex = normalizarCalle(c.exNombre);
        if (ex) claves.add(ex);
      }
      indice.push({
        fuente: 'nomenclator',
        nombre: c.nombre,
        departamento: depto?.nombre ?? null,
        localidad: ciudad?.nombre ?? null,
        calid: c.id,
        matchEstado: null,
        calleOsmId: null,
        clientes: c.cantClientesReal ?? 0,
        variantes: c.exNombre ? [c.exNombre] : [],
        claves: [...claves],
        deptoNorm: normalizarLugar(depto?.nombre ?? ''),
        locNorm: ciudad?.nombre ? normalizarLugar(ciudad.nombre) : null,
      });
    }

    this.indice = indice;
    this.cargadoEn = Date.now();
    this.logger.log(
      `Índice de calles: ${indice.length} entradas en ${Date.now() - t0}ms`,
    );
    return { calles: indice.length };
  }

  /**
   * El suggest. Prefijo primero, después contiene; dentro de cada grupo,
   * por cantidad de clientes. Deduplicado por construcción: una entrada por
   * calle (los 51 tramos de "18 de Julio" en Canelones ya colapsaron en la
   * extracción).
   */
  buscar(q: string, depto?: string, ciudad?: string, limite = 15): CalleSugerida[] {
    const qn = normalizarCalle(q);
    if (qn.length < 2) return [];
    // La consulta también se reduce a su esencia: quien tipea
    // "doctor jose terra" tiene que encontrar "José L. Terra".
    const qe = claveEsencial(qn);
    const formasQ = qe !== qn ? [qn, qe] : [qn];
    const deptoN = depto ? normalizarLugar(depto) : null;
    const ciudadN = ciudad ? normalizarLugar(ciudad) : null;

    const puntuados: { item: Indexado; rango: number }[] = [];
    for (const item of this.indice) {
      if (deptoN && item.deptoNorm !== deptoN) continue;
      if (ciudadN && item.locNorm && item.locNorm !== ciudadN) continue;
      let rango = 0;
      for (const clave of item.claves) {
        for (const fq of formasQ) {
          if (clave === fq) rango = Math.max(rango, 3);
          else if (clave.startsWith(fq)) rango = Math.max(rango, 2);
          else if (clave.includes(fq)) rango = Math.max(rango, 1);
        }
        if (rango === 3) break;
      }
      if (rango > 0) puntuados.push({ item, rango });
    }
    puntuados.sort(
      (a, b) => b.rango - a.rango || b.item.clientes - a.item.clientes,
    );
    return puntuados.slice(0, limite).map(({ item }) => {
      const { claves: _c, deptoNorm: _d, locNorm: _l, ...visible } = item;
      return visible;
    });
  }

  /** Nombre OSM exacto → registro completo con CALID. */
  resolver(nombreOsm: string, depto?: string, localidad?: string): CalleSugerida[] {
    const n = normalizarCalle(nombreOsm);
    const deptoN = depto ? normalizarLugar(depto) : null;
    const locN = localidad ? normalizarLugar(localidad) : null;
    return this.indice
      .filter(
        (i) =>
          i.claves.includes(n) &&
          (!deptoN || i.deptoNorm === deptoN) &&
          (!locN || !i.locNorm || i.locNorm === locN),
      )
      .map(({ claves: _c, deptoNorm: _d, locNorm: _l, ...visible }) => visible);
  }

  /**
   * Para las esquinas: nombre de calle OSM → CALID dentro del mismo scope.
   * Devuelve null antes que inventar.
   */
  calidDe(nombreCalle: string, depto?: string, ciudad?: string): number | null {
    const opciones = this.resolver(nombreCalle, depto, ciudad);
    const conCalid = opciones.filter((o) => o.calid !== null);
    if (conCalid.length === 0) return null;
    conCalid.sort((a, b) => b.clientes - a.clientes);
    return conCalid[0].calid;
  }

  estado() {
    return {
      entradas: this.indice.length,
      cargadoHace: this.cargadoEn ? Math.round((Date.now() - this.cargadoEn) / 1000) : null,
    };
  }

  // ─── Revisión de matches (pantalla del panel) ────────────────────────────

  async listarMatches(estado?: string, take = 50, skip = 0) {
    const where: Prisma.CalleMatchWhereInput = estado ? { estado } : {};
    const [total, filas] = await Promise.all([
      this.prisma.calleMatch.count({ where }),
      this.prisma.calleMatch.findMany({
        where,
        orderBy: [{ clientesCant: 'desc' }, { id: 'asc' }],
        take,
        skip,
      }),
    ]);
    const calids = filas.map((f) => f.calleId);
    const osmIds = filas.map((f) => f.calleOsmId);
    const [calles, osm] = await Promise.all([
      this.prisma.calle.findMany({ where: { id: { in: calids } } }),
      this.prisma.calleOsm.findMany({ where: { id: { in: osmIds } } }),
    ]);
    const ciudades = await this.prisma.ciudadNomenclator.findMany({
      where: { id: { in: calles.map((c) => c.ciudadId ?? -1) } },
    });
    const callePorId = new Map(calles.map((c) => [c.id, c]));
    const osmPorId = new Map(osm.map((o) => [o.id, o]));
    const ciudadPorId = new Map(ciudades.map((c) => [c.id, c.nombre]));

    return {
      total,
      filas: filas.map((f) => {
        const c = callePorId.get(f.calleId);
        const o = osmPorId.get(f.calleOsmId);
        return {
          id: f.id,
          estado: f.estado,
          metodo: f.metodo,
          score: Number(f.score),
          clientes: f.clientesCant,
          detalle: f.detalle,
          revisadoPor: f.revisadoPor,
          nomenclator: c
            ? {
                calid: c.id,
                nombre: c.nombre,
                exNombre: c.exNombre,
                ciudad: c.ciudadId ? (ciudadPorId.get(c.ciudadId) ?? null) : null,
              }
            : null,
          osm: o
            ? {
                id: o.id,
                nombre: o.nombre,
                localidad: o.localidad,
                departamento: o.departamento,
                lat: Number(o.latCentro),
                lng: Number(o.lngCentro),
              }
            : null,
        };
      }),
    };
  }

  /** Una calle OSM suelta, con sus puntos: para previsualizar la candidata
   *  en el mapa antes de confirmar una corrección. */
  async calleOsmDetalle(id: number) {
    const o = await this.prisma.calleOsm.findUnique({ where: { id } });
    if (!o) throw new NotFoundException(`calle_osm ${id} no existe`);
    return {
      id: o.id,
      nombre: o.nombre,
      localidad: o.localidad,
      departamento: o.departamento,
      lat: Number(o.latCentro),
      lng: Number(o.lngCentro),
      puntos: o.puntos ?? [],
    };
  }

  /** Detalle para el mapa: puntos de la calle OSM + nube de clientes del CALID.
   * Cada punto de la nube lleva CLIID y nombre: el hover del mapa identifica
   * al cliente para poder rastrearlo después en la base. */
  async mapaDeMatch(id: number) {
    const m = await this.prisma.calleMatch.findUnique({ where: { id } });
    if (!m) throw new NotFoundException(`Match ${id} no existe`);
    const [osm, clientes] = await Promise.all([
      this.prisma.calleOsm.findUnique({ where: { id: m.calleOsmId } }),
      this.prisma.cliente.findMany({
        where: { callePrincipalId: m.calleId, geoLat: { not: null } },
        select: { id: true, nombre: true, geoLat: true, geoLng: true },
        take: 300,
      }),
    ]);
    return {
      matchId: id,
      calid: m.calleId,
      calleOsm: osm
        ? { nombre: osm.nombre, puntos: osm.puntos ?? [], lat: Number(osm.latCentro), lng: Number(osm.lngCentro) }
        : null,
      clientes: clientes.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        lat: Number(c.geoLat),
        lng: Number(c.geoLng),
      })),
    };
  }

  async revisarMatch(
    id: number,
    accion: 'aprobar' | 'rechazar' | 'corregir',
    usuario: string,
    calleOsmId?: number,
  ) {
    const m = await this.prisma.calleMatch.findUnique({ where: { id } });
    if (!m) throw new NotFoundException(`Match ${id} no existe`);

    if (accion === 'corregir') {
      if (!calleOsmId) throw new NotFoundException('corregir requiere calleOsmId');
      const destino = await this.prisma.calleOsm.findUnique({ where: { id: calleOsmId } });
      if (!destino) throw new NotFoundException(`calle_osm ${calleOsmId} no existe`);
    }

    const datos: Prisma.CalleMatchUpdateInput = {
      estado: accion === 'rechazar' ? 'RECHAZADO' : 'CONFIRMADO_MANUAL',
      metodo: accion === 'corregir' ? 'MANUAL' : m.metodo,
      revisadoPor: usuario,
      revisadoAt: new Date(),
      actualizadoAt: new Date(),
    };
    if (accion === 'corregir') {
      datos.calleOsmId = calleOsmId;
      datos.score = new Prisma.Decimal(1);
    }
    const actualizado = await this.prisma.calleMatch.update({ where: { id }, data: datos });
    // El suggest sirve CALIDs: refrescar para que la revisión pegue enseguida.
    void this.recargar().catch(() => undefined);
    return actualizado;
  }
}
