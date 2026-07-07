import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MatchSugerencia } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PersonasService } from '../personas/personas.service';
import { HogarService } from '../personas/hogar.service';

export interface ListarSugerenciasQuery {
  tipo?: string;
  estado?: string;
  minConfianza?: number;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class WorkbenchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personas: PersonasService,
    private readonly hogar: HogarService,
  ) {}

  async listar(q: ListarSugerenciasQuery): Promise<Paginated<MatchSugerencia>> {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const where: Record<string, unknown> = {};
    if (q.tipo) where.tipo = q.tipo;
    if (q.estado) where.estado = q.estado;
    if (q.minConfianza != null) where.confianza = { gte: q.minConfianza };

    const [data, total] = await Promise.all([
      this.prisma.matchSugerencia.findMany({
        where,
        orderBy: { confianza: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.matchSugerencia.count({ where }),
    ]);

    return {
      data, total, page, pageSize,
    };
  }

  async aceptar(id: number, operador: string): Promise<void> {
    const sugerencia = await this.buscarPendiente(id);

    // La acción de dominio (unify / crearConMiembros) y el cambio de estado
    // de la sugerencia van en la MISMA transacción: si el update de estado
    // falla, la fusión/hogar recién creado también se revierte, en vez de
    // quedar un merge ya commiteado con la sugerencia todavía en PENDIENTE.
    await this.prisma.$transaction(async (tx) => {
      let hogarIdResuelto: number | undefined;

      if (sugerencia.tipo === 'DUPLICADO') {
        await this.personas.unify(
          [sugerencia.registroA as number, sugerencia.registroB as number],
          operador,
          tx,
        );
      } else if (sugerencia.tipo === 'HOGAR') {
        const hogarResuelto = await this.hogar.crearConMiembros(
          [sugerencia.personaA as number, sugerencia.personaB as number],
          undefined,
          tx,
        );
        hogarIdResuelto = hogarResuelto.id;
      }

      await tx.matchSugerencia.update({
        where: { id },
        data: {
          estado: 'ACEPTADO',
          resueltoAt: new Date(),
          operador,
          ...(hogarIdResuelto != null ? { hogarIdResuelto } : {}),
        },
      });
    });
  }

  async rechazar(id: number, operador: string): Promise<void> {
    const sugerencia = await this.prisma.matchSugerencia.findUnique({ where: { id } });
    if (!sugerencia) {
      throw new NotFoundException(`Sugerencia ${id} no encontrada`);
    }

    await this.prisma.matchSugerencia.update({
      where: { id },
      data: { estado: 'RECHAZADO', resueltoAt: new Date(), operador },
    });
  }

  // Para DUPLICADO no se re-parte automáticamente: el split (PersonasService.split)
  // es una acción manual y deliberada del operador, aplicada sobre los registros
  // que corresponda; deshacer solo vuelve la sugerencia a PENDIENTE para que la
  // revise de nuevo.
  async deshacer(id: number): Promise<void> {
    const sugerencia = await this.prisma.matchSugerencia.findUnique({ where: { id } });
    if (!sugerencia) {
      throw new NotFoundException(`Sugerencia ${id} no encontrada`);
    }

    // Usamos el hogarIdResuelto guardado al aceptar (preciso), no un
    // findFirst({personaId}) que podría pescar un hogar arbitrario si la
    // persona ya pertenece a más de uno. Sugerencias viejas, aceptadas antes
    // de que existiera esta columna, no tienen hogarIdResuelto: para esas no
    // podemos deshacer con precisión, así que solo se revierte el estado.
    if (
      sugerencia.tipo === 'HOGAR'
      && sugerencia.hogarIdResuelto != null
      && sugerencia.personaA != null
      && sugerencia.personaB != null
    ) {
      await this.hogar.quitarMiembro(sugerencia.hogarIdResuelto, sugerencia.personaA);
      await this.hogar.quitarMiembro(sugerencia.hogarIdResuelto, sugerencia.personaB);
    }

    await this.prisma.matchSugerencia.update({
      where: { id },
      data: { estado: 'PENDIENTE', resueltoAt: null },
    });
  }

  private async buscarPendiente(id: number): Promise<MatchSugerencia> {
    const sugerencia = await this.prisma.matchSugerencia.findUnique({ where: { id } });
    if (!sugerencia) {
      throw new NotFoundException(`Sugerencia ${id} no encontrada`);
    }
    if (sugerencia.estado !== 'PENDIENTE') {
      throw new BadRequestException(`Sugerencia ${id} no está PENDIENTE`);
    }
    return sugerencia;
  }
}
