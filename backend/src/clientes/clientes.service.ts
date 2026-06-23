import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: QueryClientesDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const where: Prisma.ClienteWhereInput = {};
    if (q.estado) where.estado = q.estado;
    if (q.zona !== undefined) where.zona = q.zona;
    if (q.tipoId !== undefined) where.tipoId = q.tipoId;

    if (q.search) {
      const s = q.search.trim();
      where.OR = [
        { nombre: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { ruc: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.cliente.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { id: 'asc' },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(id: number) {
    const cliente = await this.prisma.cliente.findUnique({ where: { id } });
    if (!cliente) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }
    return cliente;
  }

  async create(dto: CreateClienteDto) {
    return this.prisma.cliente.create({ data: dto as Prisma.ClienteCreateInput });
  }

  async update(id: number, dto: UpdateClienteDto) {
    await this.findOne(id);
    return this.prisma.cliente.update({
      where: { id },
      data: dto as Prisma.ClienteUpdateInput,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.cliente.delete({ where: { id } });
    return { id, deleted: true };
  }
}
