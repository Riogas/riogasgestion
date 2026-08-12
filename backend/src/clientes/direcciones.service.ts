import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { busquedaNorm } from '../common/direccion/normalize-direccion';
import { DireccionInputDto } from './dto/direccion-input.dto';

@Injectable()
export class DireccionesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(clienteId: number, dto: DireccionInputDto) {
    await this.assertClienteExists(clienteId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.principal) {
        await tx.clienteDireccion.updateMany({
          where: { clienteId },
          data: { principal: false },
        });
      }
      return tx.clienteDireccion.create({
        data: { clienteId, ...this.mapData(dto), estado: dto.estado ?? 'A' },
      });
    });
  }

  async update(clienteId: number, dirId: number, dto: Partial<DireccionInputDto>) {
    await this.assertDireccion(clienteId, dirId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.principal) {
        await tx.clienteDireccion.updateMany({
          where: { clienteId },
          data: { principal: false },
        });
      }
      return tx.clienteDireccion.update({
        where: { id: dirId },
        data: this.mapData(dto),
      });
    });
  }

  async remove(clienteId: number, dirId: number) {
    const dir = await this.assertDireccion(clienteId, dirId);
    const count = await this.prisma.clienteDireccion.count({ where: { clienteId } });
    if (count === 1) {
      throw new BadRequestException('No se puede borrar la única dirección del cliente');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.clienteDireccion.delete({ where: { id: dirId } });
      if (dir.principal) {
        const next = await tx.clienteDireccion.findFirst({
          where: { clienteId },
          orderBy: { id: 'asc' },
        });
        if (next) {
          await tx.clienteDireccion.update({
            where: { id: next.id },
            data: { principal: true },
          });
        }
      }
      return { id: dirId, deleted: true };
    });
  }

  private mapData(d: Partial<DireccionInputDto>) {
    return {
      calle: d.calle,
      nro: d.nro,
      esquina1: d.esquina1,
      esquina2: d.esquina2,
      apto: d.apto,
      local: d.local,
      departamentoId: d.departamentoId,
      localidadId: d.localidadId,
      lat: d.lat !== undefined ? new Prisma.Decimal(d.lat) : undefined,
      lng: d.lng !== undefined ? new Prisma.Decimal(d.lng) : undefined,
      direccion: d.direccion,
      // undefined (update parcial sin direccion) no debe pisar la clave.
      direccionBusq:
        d.direccion === undefined
          ? undefined
          : d.direccion
            ? busquedaNorm(d.direccion)
            : null,
      principal: d.principal,
      estado: d.estado,
      // Marca "el operador tocó esta fila": el sync semanal deja de pisarla
      // con el espejo AS400.
      editadoPanelAt: new Date(),
    };
  }

  private async assertClienteExists(clienteId: number) {
    const c = await this.prisma.clienteUni.findUnique({ where: { id: clienteId } });
    if (!c) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
  }

  private async assertDireccion(clienteId: number, dirId: number) {
    const dir = await this.prisma.clienteDireccion.findUnique({ where: { id: dirId } });
    if (!dir || dir.clienteId !== clienteId) {
      throw new NotFoundException(`Dirección ${dirId} no encontrada`);
    }
    return dir;
  }
}
