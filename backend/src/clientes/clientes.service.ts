import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { busquedaNorm } from '../common/direccion/normalize-direccion';
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
      const or: Prisma.ClienteUniWhereInput[] = [
        { nombre: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { ruc: { contains: s, mode: 'insensitive' } },
        { cedula: { contains: s, mode: 'insensitive' } },
      ];
      // Dirección y teléfono se resuelven APARTE, directo contra el índice
      // trigram de cada tabla hija, y entran al OR como `id IN (...)`. Un
      // EXISTS correlacionado dentro del OR obliga a evaluar el subplan por
      // cada una de las 1,13M filas de cliente_uni (medido: 10s con un
      // término frecuente); así queda igual de rápido que el buscador viejo.
      const busq = busquedaNorm(s);
      const digitos = s.replace(/\D/g, '').replace(/^0+/, '');
      const [idsDir, idsTel] = await Promise.all([
        // trigram necesita ≥3 caracteres para discriminar.
        busq.length >= 3 ? this.idsPorDireccion(busq) : null,
        // TELFNRO es numérico en el AS400: se guarda sin el 0 inicial y sin
        // separadores ("097 479 212" está como "97479212").
        digitos.length >= 5 ? this.idsPorTelefono(digitos) : null,
      ]);
      if (idsDir?.length) or.push({ id: { in: idsDir } });
      if (idsTel?.length) or.push({ id: { in: idsTel } });
      where.OR = or;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.clienteUni.findMany({
        where,
        include: { direcciones: { where: { principal: true }, take: 1 } },
        skip: (page - 1) * pageSize,
        take: pageSize,
        // Más recientes primero por última llamada; id desc como desempate
        // estable. Apoyado por el índice (estado, ultimaLlamada DESC, id DESC)
        // → Index Only Scan, evita el full sort de 1.13M filas.
        // (0 clientes activos tienen ultimaLlamada nula, así que el orden de
        //  nulls es irrelevante; se usa DESC plano para coincidir con el índice.)
        orderBy: [{ ultimaLlamada: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.clienteUni.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  // Tope de ids por eje de búsqueda: si un término matchea más que esto
  // (p.ej. "montevideo" por dirección → ~900k), no discrimina nada y el eje
  // se descarta — los otros ejes del OR (nombre, etc.) siguen aplicando.
  private static readonly MAX_IDS_BUSQ = 2000;

  private async idsPorDireccion(busq: string): Promise<number[] | null> {
    const like = `%${busq.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const filas = await this.prisma.$queryRaw<{ clienteId: number }[]>`
      SELECT DISTINCT "clienteId" FROM cliente_direccion
      WHERE "direccionBusq" LIKE ${like}
      LIMIT ${ClientesService.MAX_IDS_BUSQ + 1}`;
    if (filas.length > ClientesService.MAX_IDS_BUSQ) return null;
    return filas.map((f) => f.clienteId);
  }

  private async idsPorTelefono(digitos: string): Promise<number[] | null> {
    const filas = await this.prisma.$queryRaw<{ clienteId: number }[]>`
      SELECT DISTINCT "clienteId" FROM cliente_telefono
      WHERE numero LIKE ${`%${digitos}%`}
      LIMIT ${ClientesService.MAX_IDS_BUSQ + 1}`;
    if (filas.length > ClientesService.MAX_IDS_BUSQ) return null;
    return filas.map((f) => f.clienteId);
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
          editadoPanelAt: new Date(),
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
        editadoPanelAt: new Date(),
      },
    });
    return this.findOne(id);
  }

  async softDelete(id: number) {
    await this.findOne(id);
    await this.prisma.clienteUni.update({
      where: { id },
      data: { estado: 'I', editadoPanelAt: new Date() },
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
      direccionBusq: d.direccion ? busquedaNorm(d.direccion) : null,
      principal: d.principal,
      estado: d.estado ?? 'A',
      editadoPanelAt: new Date(),
    };
  }

  private assertOnePrincipal(arr: { principal: boolean }[], label: string) {
    if (arr.filter((x) => x.principal).length !== 1) {
      throw new BadRequestException(`Debe haber exactamente 1 ${label} principal`);
    }
  }
}
