import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ClienteDireccion, ClienteTelefono, ClienteUni, Hogar, Persona,
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

  async unify(registroIds: number[], operador?: string): Promise<{ personaId: number }> {
    if (!registroIds || registroIds.length === 0) {
      throw new BadRequestException('Debe indicar al menos un registro para unificar');
    }

    return this.prisma.$transaction(async (tx) => {
      const primerRegistro = await tx.clienteUni.findUnique({
        where: { id: registroIds[0] },
      });
      if (!primerRegistro) {
        throw new NotFoundException(`Registro ${registroIds[0]} no encontrado`);
      }
      const destinoPersonaId = primerRegistro.personaId;
      if (destinoPersonaId == null) {
        throw new BadRequestException(`Registro ${registroIds[0]} no tiene persona asociada`);
      }

      const registrosAMover = await tx.clienteUni.findMany({
        where: { id: { in: registroIds } },
      });
      const personaIdsOrigen = Array.from(
        new Set(
          registrosAMover
            .map((r) => r.personaId)
            .filter((id): id is number => id != null && id !== destinoPersonaId),
        ),
      );

      await tx.clienteUni.updateMany({
        where: { id: { in: registroIds } },
        data: { personaId: destinoPersonaId },
      });

      for (const personaId of personaIdsOrigen) {
        const restantes = await tx.clienteUni.count({ where: { personaId } });
        if (restantes === 0) {
          await tx.persona.delete({ where: { id: personaId } });
        }
      }

      return { personaId: destinoPersonaId };
    });
  }

  async setCanonical(personaId: number, dto: SetCanonicalDto): Promise<Persona> {
    const existente = await this.prisma.persona.findUnique({ where: { id: personaId } });
    if (!existente) {
      throw new NotFoundException(`Persona ${personaId} no encontrada`);
    }

    return this.prisma.persona.update({
      where: { id: personaId },
      data: {
        nombreOficial: dto.nombreOficial,
        cedula: dto.cedula,
        telefonoPrincipalId: dto.telefonoPrincipalId,
        direccionPrincipalId: dto.direccionPrincipalId,
      },
    });
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
