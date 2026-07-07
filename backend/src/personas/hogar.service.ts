import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Hogar, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HogarService {
  constructor(private readonly prisma: PrismaService) {}

  async crearConMiembros(
    personaIds: number[],
    etiqueta?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Hogar> {
    if (!personaIds || personaIds.length === 0) {
      throw new BadRequestException('Debe indicar al menos una persona para el hogar');
    }

    const ejecutar = async (client: Prisma.TransactionClient): Promise<Hogar> => {
      const primeraPersona = await client.persona.findUnique({
        where: { id: personaIds[0] },
        include: { direccionPrincipal: true },
      });
      if (!primeraPersona) {
        throw new NotFoundException(`Persona ${personaIds[0]} no encontrada`);
      }

      const direccionPrincipal = primeraPersona.direccionPrincipal;
      const direccionTextoNorm = direccionPrincipal?.direccionTextoNorm ?? null;

      let hogar: Hogar | null = null;
      if (direccionTextoNorm) {
        hogar = await client.hogar.findFirst({ where: { direccionTextoNorm } });
      }

      if (!hogar) {
        hogar = await client.hogar.create({
          data: {
            etiqueta,
            direccionTextoNorm,
            lat: direccionPrincipal?.lat ?? null,
            lng: direccionPrincipal?.lng ?? null,
          },
        });
      }

      const hogarId = hogar.id;
      for (const personaId of personaIds) {
        const existente = await client.hogarMiembro.findUnique({
          where: { hogarId_personaId: { hogarId, personaId } },
        });
        if (!existente) {
          await client.hogarMiembro.create({ data: { hogarId, personaId } });
        }
      }

      return hogar;
    };

    if (tx) return ejecutar(tx);
    return this.prisma.$transaction((t) => ejecutar(t));
  }

  async agregarMiembro(hogarId: number, personaId: number, rol?: string): Promise<void> {
    await this.prisma.hogarMiembro.upsert({
      where: { hogarId_personaId: { hogarId, personaId } },
      update: { rol },
      create: { hogarId, personaId, rol },
    });
  }

  async quitarMiembro(hogarId: number, personaId: number): Promise<void> {
    await this.prisma.hogarMiembro.deleteMany({
      where: { hogarId, personaId },
    });
  }
}
