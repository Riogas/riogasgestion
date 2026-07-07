import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Hogar } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HogarService {
  constructor(private readonly prisma: PrismaService) {}

  async crearConMiembros(personaIds: number[], etiqueta?: string): Promise<Hogar> {
    if (!personaIds || personaIds.length === 0) {
      throw new BadRequestException('Debe indicar al menos una persona para el hogar');
    }

    return this.prisma.$transaction(async (tx) => {
      const primeraPersona = await tx.persona.findUnique({
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
        hogar = await tx.hogar.findFirst({ where: { direccionTextoNorm } });
      }

      if (!hogar) {
        hogar = await tx.hogar.create({
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
        const existente = await tx.hogarMiembro.findUnique({
          where: { hogarId_personaId: { hogarId, personaId } },
        });
        if (!existente) {
          await tx.hogarMiembro.create({ data: { hogarId, personaId } });
        }
      }

      return hogar;
    });
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
