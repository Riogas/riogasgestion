import {
  BadRequestException, ConflictException, Injectable, NotFoundException,
} from '@nestjs/common';
import {
  ClienteDireccion, ClienteTelefono, ClienteUni, Hogar, Persona, Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RegistroConDetalle = ClienteUni & {
  telefonos: ClienteTelefono[];
  direcciones: ClienteDireccion[];
};

export interface Persona360 {
  persona: Persona;
  registros: RegistroConDetalle[];
  telefonos: ClienteTelefono[];
  direcciones: ClienteDireccion[];
  hogares: Hogar[];
}

export interface SetCanonicalDto {
  nombreOficial?: string;
  cedula?: string;
  telefonoPrincipalId?: number;
  direccionPrincipalId?: number;
}

@Injectable()
export class PersonasService {
  constructor(private readonly prisma: PrismaService) {}

  async find360(personaId: number): Promise<Persona360> {
    const persona = await this.prisma.persona.findUnique({
      where: { id: personaId },
      include: {
        registros: { include: { telefonos: true, direcciones: true } },
        miembroDe: { include: { hogar: true } },
      },
    });
    if (!persona) {
      throw new NotFoundException(`Persona ${personaId} no encontrada`);
    }

    const telefonos = persona.registros.flatMap((r) => r.telefonos);
    const direcciones = persona.registros.flatMap((r) => r.direcciones);
    const hogares = persona.miembroDe.map((m) => m.hogar);

    return {
      persona,
      registros: persona.registros,
      telefonos,
      direcciones,
      hogares,
    };
  }

  async unify(
    registroIds: number[],
    operador?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ personaId: number }> {
    if (!registroIds || registroIds.length === 0) {
      throw new BadRequestException('Debe indicar al menos un registro para unificar');
    }

    const ejecutar = async (client: Prisma.TransactionClient): Promise<{ personaId: number }> => {
      const primerRegistro = await client.clienteUni.findUnique({
        where: { id: registroIds[0] },
      });
      if (!primerRegistro) {
        throw new NotFoundException(`Registro ${registroIds[0]} no encontrado`);
      }
      const destinoPersonaId = primerRegistro.personaId;
      if (destinoPersonaId == null) {
        throw new BadRequestException(`Registro ${registroIds[0]} no tiene persona asociada`);
      }

      const registrosAMover = await client.clienteUni.findMany({
        where: { id: { in: registroIds } },
      });
      const personaIdsOrigen = Array.from(
        new Set(
          registrosAMover
            .map((r) => r.personaId)
            .filter((id): id is number => id != null && id !== destinoPersonaId),
        ),
      );

      await client.clienteUni.updateMany({
        where: { id: { in: registroIds } },
        data: { personaId: destinoPersonaId },
      });

      for (const personaId of personaIdsOrigen) {
        const restantes = await client.clienteUni.count({ where: { personaId } });
        if (restantes === 0) {
          // Cobertura y HogarMiembro son onDelete:Cascade: si no transferimos
          // esas filas antes de borrar la persona huérfana, se pierden para
          // siempre y split() ya no puede reconstruirlas (rompe reversibilidad).
          await this.transferirAfiliaciones(client, personaId, destinoPersonaId);
          await client.persona.delete({ where: { id: personaId } });
        }
      }

      return { personaId: destinoPersonaId };
    };

    if (tx) return ejecutar(tx);
    return this.prisma.$transaction((t) => ejecutar(t));
  }

  // Repunta cobertura/hogarMiembro de una persona origen (a punto de ser
  // borrada por quedar huérfana) hacia la persona destino de la unificación.
  // En caso de conflicto con una fila ya existente del destino: para
  // cobertura nos quedamos con la ultFecha más reciente y sumamos
  // cantPedidos; para hogarMiembro descartamos el duplicado.
  private async transferirAfiliaciones(
    client: Prisma.TransactionClient,
    personaIdOrigen: number,
    personaIdDestino: number,
  ): Promise<void> {
    const coberturasOrigen = await client.cobertura.findMany({ where: { personaId: personaIdOrigen } });
    for (const c of coberturasOrigen) {
      const existente = await client.cobertura.findUnique({
        where: {
          personaId_empresaFleteraId: { personaId: personaIdDestino, empresaFleteraId: c.empresaFleteraId },
        },
      });
      if (existente) {
        const ultFecha = existente.ultFecha && c.ultFecha && existente.ultFecha > c.ultFecha
          ? existente.ultFecha
          : c.ultFecha;
        await client.cobertura.update({
          where: {
            personaId_empresaFleteraId: { personaId: personaIdDestino, empresaFleteraId: c.empresaFleteraId },
          },
          data: { ultFecha, cantPedidos: (existente.cantPedidos ?? 0) + (c.cantPedidos ?? 0) },
        });
        await client.cobertura.delete({ where: { id: c.id } });
      } else {
        await client.cobertura.update({ where: { id: c.id }, data: { personaId: personaIdDestino } });
      }
    }

    const miembrosOrigen = await client.hogarMiembro.findMany({ where: { personaId: personaIdOrigen } });
    for (const m of miembrosOrigen) {
      const existente = await client.hogarMiembro.findUnique({
        where: { hogarId_personaId: { hogarId: m.hogarId, personaId: personaIdDestino } },
      });
      if (existente) {
        await client.hogarMiembro.delete({ where: { id: m.id } });
      } else {
        await client.hogarMiembro.update({ where: { id: m.id }, data: { personaId: personaIdDestino } });
      }
    }
  }

  async setCanonical(personaId: number, dto: SetCanonicalDto): Promise<Persona> {
    const existente = await this.prisma.persona.findUnique({ where: { id: personaId } });
    if (!existente) {
      throw new NotFoundException(`Persona ${personaId} no encontrada`);
    }

    try {
      return await this.prisma.persona.update({
        where: { id: personaId },
        data: {
          nombreOficial: dto.nombreOficial,
          cedula: dto.cedula,
          telefonoPrincipalId: dto.telefonoPrincipalId,
          direccionPrincipalId: dto.direccionPrincipalId,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('cedula ya asignada a otra persona');
      }
      throw err;
    }
  }

  async split(registroIds: number[]): Promise<{ nuevas: number[] }> {
    if (!registroIds || registroIds.length === 0) {
      throw new BadRequestException('Debe indicar al menos un registro para dividir');
    }

    return this.prisma.$transaction(async (tx) => {
      const nuevas: number[] = [];

      for (const registroId of registroIds) {
        const registro = await tx.clienteUni.findUnique({ where: { id: registroId } });
        if (!registro) {
          throw new NotFoundException(`Registro ${registroId} no encontrado`);
        }

        const nuevaPersona = await tx.persona.create({
          data: { nombreOficial: registro.nombre },
        });

        await tx.clienteUni.update({
          where: { id: registroId },
          data: { personaId: nuevaPersona.id },
        });

        nuevas.push(nuevaPersona.id);
      }

      return { nuevas };
    });
  }
}
