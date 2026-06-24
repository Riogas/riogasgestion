import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelefonoInputDto } from './dto/telefono-input.dto';

@Injectable()
export class TelefonosService {
  constructor(private readonly prisma: PrismaService) {}

  async add(clienteId: number, dto: TelefonoInputDto) {
    await this.assertClienteExists(clienteId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.principal) {
        await tx.clienteTelefono.updateMany({
          where: { clienteId },
          data: { principal: false },
        });
      }
      return tx.clienteTelefono.create({
        data: {
          clienteId,
          numero: dto.numero,
          tipo: dto.tipo,
          estado: dto.estado ?? 'A',
          alias: dto.alias,
          principal: dto.principal,
        },
      });
    });
  }

  async update(clienteId: number, telId: number, dto: Partial<TelefonoInputDto>) {
    await this.assertTelefono(clienteId, telId);
    return this.prisma.$transaction(async (tx) => {
      if (dto.principal) {
        await tx.clienteTelefono.updateMany({
          where: { clienteId },
          data: { principal: false },
        });
      }
      const data: Prisma.ClienteTelefonoUpdateInput = {
        numero: dto.numero,
        tipo: dto.tipo,
        estado: dto.estado,
        alias: dto.alias,
        principal: dto.principal,
      };
      return tx.clienteTelefono.update({ where: { id: telId }, data });
    });
  }

  async remove(clienteId: number, telId: number) {
    const tel = await this.assertTelefono(clienteId, telId);
    const count = await this.prisma.clienteTelefono.count({ where: { clienteId } });
    if (count === 1) {
      throw new BadRequestException('No se puede borrar el único teléfono del cliente');
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.clienteTelefono.delete({ where: { id: telId } });
      if (tel.principal) {
        const next = await tx.clienteTelefono.findFirst({
          where: { clienteId },
          orderBy: { id: 'asc' },
        });
        if (next) {
          await tx.clienteTelefono.update({
            where: { id: next.id },
            data: { principal: true },
          });
        }
      }
      return { id: telId, deleted: true };
    });
  }

  private async assertClienteExists(clienteId: number) {
    const c = await this.prisma.clienteUni.findUnique({ where: { id: clienteId } });
    if (!c) throw new NotFoundException(`Cliente ${clienteId} no encontrado`);
  }

  private async assertTelefono(clienteId: number, telId: number) {
    const tel = await this.prisma.clienteTelefono.findUnique({ where: { id: telId } });
    if (!tel || tel.clienteId !== clienteId) {
      throw new NotFoundException(`Teléfono ${telId} no encontrado`);
    }
    return tel;
  }
}
