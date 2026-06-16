import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { ClienteTelefono } from './entities/cliente-telefono.entity';
import { ClienteDireccion } from './entities/cliente-direccion.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';
import { CreateTelefonoDto } from './dto/create-telefono.dto';
import { UpdateTelefonoDto } from './dto/update-telefono.dto';
import { CreateDireccionDto } from './dto/create-direccion.dto';
import { UpdateDireccionDto } from './dto/update-direccion.dto';
import { EstadoCliente } from './enums';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clientes: Repository<Cliente>,
    @InjectRepository(ClienteTelefono)
    private readonly telefonos: Repository<ClienteTelefono>,
    @InjectRepository(ClienteDireccion)
    private readonly direcciones: Repository<ClienteDireccion>,
  ) {}

  async create(dto: CreateClienteDto): Promise<Cliente> {
    const now = new Date();
    const telefonos = (dto.telefonos ?? []).map((t) => this.telefonos.create(t));
    const direcciones = (dto.direcciones ?? []).map((d) => this.direcciones.create(d));
    const cliente = this.clientes.create({
      ...dto,
      telefonos,
      direcciones,
      estado: dto.estado ?? EstadoCliente.ACTIVO,
      fechaAlta: now,
      fechaUltModif: now,
    });
    return this.clientes.save(cliente);
  }

  async findAll(q: QueryClientesDto) {
    const page = q.page ?? 1;
    const pageSize = q.pageSize ?? 20;
    const base: FindOptionsWhere<Cliente> = {};
    if (q.estado) base.estado = q.estado;
    if (q.tipoCliente) base.tipoCliente = q.tipoCliente;

    let where: FindOptionsWhere<Cliente> | FindOptionsWhere<Cliente>[] = base;
    if (q.search) {
      const s = ILike(`%${q.search}%`);
      where = [
        { ...base, nombre: s },
        { ...base, apellido: s },
        { ...base, email: s },
      ];
    }

    const [data, total] = await this.clientes.findAndCount({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      order: { createdAt: 'DESC' },
    });
    return { data, total, page, pageSize };
  }

  async findOne(id: string): Promise<Cliente> {
    const cliente = await this.clientes.findOne({
      where: { id },
      relations: { telefonos: true, direcciones: true },
    });
    if (!cliente) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }
    return cliente;
  }

  async update(id: string, dto: UpdateClienteDto): Promise<Cliente> {
    const cliente = await this.findOne(id);
    Object.assign(cliente, dto);
    cliente.fechaUltModif = new Date();
    return this.clientes.save(cliente);
  }

  async remove(id: string): Promise<{ id: string; estado: EstadoCliente }> {
    const cliente = await this.findOne(id);
    cliente.estado = EstadoCliente.INACTIVO;
    cliente.fechaUltModif = new Date();
    await this.clientes.save(cliente);
    return { id: cliente.id, estado: cliente.estado };
  }

  // --- Teléfonos ---
  async addTelefono(clienteId: string, dto: CreateTelefonoDto): Promise<ClienteTelefono> {
    await this.findOne(clienteId);
    const tel = this.telefonos.create({ ...dto, cliente: { id: clienteId } as Cliente });
    return this.telefonos.save(tel);
  }

  async updateTelefono(
    clienteId: string,
    telId: string,
    dto: UpdateTelefonoDto,
  ): Promise<ClienteTelefono> {
    const tel = await this.telefonos.findOne({
      where: { id: telId, cliente: { id: clienteId } },
    });
    if (!tel) {
      throw new NotFoundException(`Teléfono ${telId} no encontrado`);
    }
    Object.assign(tel, dto);
    return this.telefonos.save(tel);
  }

  async removeTelefono(clienteId: string, telId: string): Promise<{ deleted: true }> {
    const res = await this.telefonos.delete({ id: telId, cliente: { id: clienteId } });
    if (!res.affected) {
      throw new NotFoundException(`Teléfono ${telId} no encontrado`);
    }
    return { deleted: true };
  }

  // --- Direcciones ---
  async addDireccion(clienteId: string, dto: CreateDireccionDto): Promise<ClienteDireccion> {
    await this.findOne(clienteId);
    const dir = this.direcciones.create({ ...dto, cliente: { id: clienteId } as Cliente });
    return this.direcciones.save(dir);
  }

  async updateDireccion(
    clienteId: string,
    dirId: string,
    dto: UpdateDireccionDto,
  ): Promise<ClienteDireccion> {
    const dir = await this.direcciones.findOne({
      where: { id: dirId, cliente: { id: clienteId } },
    });
    if (!dir) {
      throw new NotFoundException(`Dirección ${dirId} no encontrada`);
    }
    Object.assign(dir, dto);
    return this.direcciones.save(dir);
  }

  async removeDireccion(clienteId: string, dirId: string): Promise<{ deleted: true }> {
    const res = await this.direcciones.delete({ id: dirId, cliente: { id: clienteId } });
    if (!res.affected) {
      throw new NotFoundException(`Dirección ${dirId} no encontrada`);
    }
    return { deleted: true };
  }
}
