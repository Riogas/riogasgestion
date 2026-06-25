import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EscenarioInputDto } from './dto/escenario-input.dto';

// CRUD de "Escenarios y prioridad" → movil_zona.
@Injectable()
export class EscenariosService {
  constructor(private readonly prisma: PrismaService) {}

  async add(movilId: number, dto: EscenarioInputDto) {
    const movil = await this.assertMovil(movilId);
    return this.prisma.movilZona.create({
      data: { movilId, origen: movil.origen, ...this.mapData(dto) },
    });
  }

  async update(movilId: number, zonaId: number, dto: EscenarioInputDto) {
    await this.assertZona(movilId, zonaId);
    return this.prisma.movilZona.update({
      where: { id: zonaId },
      data: this.mapData(dto),
    });
  }

  async remove(movilId: number, zonaId: number) {
    await this.assertZona(movilId, zonaId);
    await this.prisma.movilZona.delete({ where: { id: zonaId } });
    return { id: zonaId, deleted: true };
  }

  private mapData(d: EscenarioInputDto) {
    return {
      escenarioId: d.escenarioId,
      canalId: d.canalId,
      zonaId: d.zonaId,
      tipo: d.tipo,
    };
  }

  private async assertMovil(movilId: number) {
    const m = await this.prisma.movil.findUnique({ where: { id: movilId } });
    if (!m) throw new NotFoundException(`Móvil ${movilId} no encontrado`);
    return m;
  }

  private async assertZona(movilId: number, zonaId: number) {
    const z = await this.prisma.movilZona.findUnique({ where: { id: zonaId } });
    if (!z || z.movilId !== movilId) {
      throw new NotFoundException(`Escenario ${zonaId} no encontrado`);
    }
    return z;
  }
}
