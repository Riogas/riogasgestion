import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServicioInputDto } from './dto/servicio-input.dto';

// CRUD de "Servicios habilitados" → movil_servicio.
@Injectable()
export class ServiciosMovilService {
  constructor(private readonly prisma: PrismaService) {}

  async add(movilId: number, dto: ServicioInputDto) {
    const movil = await this.assertMovil(movilId);
    return this.prisma.movilServicio.create({
      data: { movilId, origen: movil.origen, servicioId: dto.servicioId },
    });
  }

  async update(movilId: number, msId: number, dto: ServicioInputDto) {
    await this.assertServicio(movilId, msId);
    return this.prisma.movilServicio.update({
      where: { id: msId },
      data: { servicioId: dto.servicioId },
    });
  }

  async remove(movilId: number, msId: number) {
    await this.assertServicio(movilId, msId);
    await this.prisma.movilServicio.delete({ where: { id: msId } });
    return { id: msId, deleted: true };
  }

  private async assertMovil(movilId: number) {
    const m = await this.prisma.movil.findUnique({ where: { id: movilId } });
    if (!m) throw new NotFoundException(`Móvil ${movilId} no encontrado`);
    return m;
  }

  private async assertServicio(movilId: number, msId: number) {
    const s = await this.prisma.movilServicio.findUnique({ where: { id: msId } });
    if (!s || s.movilId !== movilId) {
      throw new NotFoundException(`Servicio ${msId} no encontrado`);
    }
    return s;
  }
}
