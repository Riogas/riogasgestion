import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';
import { DireccionInputDto } from './dto/direccion-input.dto';
import { TelefonoInputDto } from './dto/telefono-input.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: QueryClientesDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;

    const where: Prisma.ClienteUniWhereInput = {};
    if (q.estado) where.estado = q.estado;
    if (q.origen) where.origen = q.origen;
    if (q.tipoClienteId !== undefined) where.tipoClienteId = q.tipoClienteId;
    if (q.dedupRevisar !== undefined) where.dedupRevisar = q.dedupRevisar;

    if (q.search) {
      const s = q.search.trim();
      where.OR = [
        { nombre: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { ruc: { contains: s, mode: 'insensitive' } },
        { cedula: { contains: s, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.clienteUni.findMany({
        where,
        include: { direcciones: { where: { principal: true }, take: 1 } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        // Más recientes primero por última llamada (nulls al final);
        // id desc como desempate estable. Apoyado por el índice
        // (estado, ultimaLlamada DESC) para evitar el full sort.
        orderBy: [
          { ultimaLlamada: { sort: 'desc', nulls: 'last' } },
          { id: 'desc' },
        ],
      }),
      this.prisma.clienteUni.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(id: number) {
    const cliente = await this.prisma.clienteUni.findUnique({
      where: { id },
      include: { telefonos: true, direcciones: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }
    return cliente;
  }

  async create(dto: CreateClienteDto, username?: string) {
    this.assertOnePrincipal(dto.direcciones, 'direcciones');
    this.assertOnePrincipal(dto.telefonos, 'telefonos');

    const created = await this.prisma.$transaction(async (tx) => {
      const cliente = await tx.clienteUni.create({
        data: {
          origen: 'capital',
          idOriginal: 0,
          nombre: dto.nombre,
          ruc: dto.ruc,
          cedula: dto.cedula,
          email: dto.email,
          estado: dto.estado ?? 'A',
          tipoClienteId: dto.tipoClienteId,
          categoriaPrecioId: dto.categoriaPrecioId,
          vip: dto.vip,
          observaciones: dto.observaciones,
          observacionesComerc: dto.observacionesComerc,
          operadorAlta: username,
          fechaAlta: new Date(),
          telefonos: {
            create: dto.telefonos.map((t) => this.mapTelefono(t)),
          },
          direcciones: {
            create: dto.direcciones.map((d) => this.mapDireccion(d)),
          },
        },
      });

      // idOriginal placeholder = el propio id autoincrement hasta que exista sync.
      await tx.clienteUni.update({
        where: { id: cliente.id },
        data: { idOriginal: cliente.id },
      });

      return cliente;
    });

    return this.findOne(created.id);
  }

  async update(id: number, dto: UpdateClienteDto, username?: string) {
    await this.findOne(id);
    await this.prisma.clienteUni.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        ruc: dto.ruc,
        cedula: dto.cedula,
        email: dto.email,
        estado: dto.estado,
        tipoClienteId: dto.tipoClienteId,
        categoriaPrecioId: dto.categoriaPrecioId,
        vip: dto.vip,
        observaciones: dto.observaciones,
        observacionesComerc: dto.observacionesComerc,
        operadorModificacion: username,
      },
    });
    return this.findOne(id);
  }

  async softDelete(id: number) {
    await this.findOne(id);
    await this.prisma.clienteUni.update({
      where: { id },
      data: { estado: 'I' },
    });
    return { id, estado: 'I' };
  }

  private mapTelefono(t: TelefonoInputDto): Prisma.ClienteTelefonoCreateWithoutClienteInput {
    return {
      numero: t.numero,
      tipo: t.tipo,
      estado: t.estado ?? 'A',
      alias: t.alias,
      principal: t.principal,
    };
  }

  private mapDireccion(d: DireccionInputDto): Prisma.ClienteDireccionCreateWithoutClienteInput {
    return {
      calle: d.calle,
      nro: d.nro,
      esquina1: d.esquina1,
      esquina2: d.esquina2,
      apto: d.apto,
      local: d.local,
      departamentoId: d.departamentoId,
      localidadId: d.localidadId,
      lat: d.lat !== undefined ? new Prisma.Decimal(d.lat) : null,
      lng: d.lng !== undefined ? new Prisma.Decimal(d.lng) : null,
      direccion: d.direccion,
      principal: d.principal,
      estado: d.estado ?? 'A',
    };
  }

  private assertOnePrincipal(arr: { principal: boolean }[], label: string) {
    if (arr.filter((x) => x.principal).length !== 1) {
      throw new BadRequestException(`Debe haber exactamente 1 ${label} principal`);
    }
  }
}
