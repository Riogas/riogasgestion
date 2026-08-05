import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CODIGO_REGEX,
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

  constructor(private readonly prisma: PrismaService) {}

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
      const tieneGps = dto.gpsLat != null && dto.gpsLng != null;

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
          // Task 5 enriquece estos campos con geo por IP y reverse Nominatim.
          gpsLat: tieneGps ? dto.gpsLat : null,
          gpsLng: tieneGps ? dto.gpsLng : null,
          geoFuente: tieneGps ? 'gps' : null,
        },
      });

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
    });
  }

  async regenerarMomentosPendientes(id: number) {
    const ahora = new Date();

    return this.prisma.$transaction(async (tx) => {
      const sorteo = await tx.sorteo.findUnique({ where: { id } });
      if (!sorteo) throw new NotFoundException(`Sorteo ${id} no encontrado`);

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
    });
  }
}
