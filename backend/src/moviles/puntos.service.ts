import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PuntoInputDto } from './dto/punto-input.dto';

// CRUD de "Ptos de recarga" → movil_punto_recarga.
@Injectable()
export class PuntosService {
  constructor(private readonly prisma: PrismaService) {}

  async add(movilId: number, dto: PuntoInputDto) {
    const movil = await this.assertMovil(movilId);
    return this.prisma.movilPuntoRecarga.create({
      data: { movilId, origen: movil.origen, nombre: dto.nombre, puntoId: dto.puntoId },
    });
  }

  async update(movilId: number, puntoId: number, dto: PuntoInputDto) {
    await this.assertPunto(movilId, puntoId);
    return this.prisma.movilPuntoRecarga.update({
      where: { id: puntoId },
      data: { nombre: dto.nombre, puntoId: dto.puntoId },
    });
  }

  async remove(movilId: number, puntoId: number) {
    await this.assertPunto(movilId, puntoId);
    await this.prisma.movilPuntoRecarga.delete({ where: { id: puntoId } });
    return { id: puntoId, deleted: true };
  }

  private async assertMovil(movilId: number) {
    const m = await this.prisma.movil.findUnique({ where: { id: movilId } });
    if (!m) throw new NotFoundException(`Móvil ${movilId} no encontrado`);
    return m;
  }

  private async assertPunto(movilId: number, puntoId: number) {
    const p = await this.prisma.movilPuntoRecarga.findUnique({ where: { id: puntoId } });
    if (!p || p.movilId !== movilId) {
      throw new NotFoundException(`Punto de recarga ${puntoId} no encontrado`);
    }
    return p;
  }
}
