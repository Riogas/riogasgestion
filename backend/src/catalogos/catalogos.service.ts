import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogosService {
  constructor(private readonly prisma: PrismaService) {}

  async tiposCliente() {
    const rows = await this.prisma.tipoCliente.findMany({
      orderBy: { descripcion: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, descripcion: r.descripcion }));
  }

  async categoriasPrecio() {
    const rows = await this.prisma.categoriaPrecio.findMany({
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, nombre: r.nombre }));
  }

  async departamentos() {
    const rows = await this.prisma.departamento.findMany({
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, nombre: r.nombre }));
  }

  async localidades(departamentoId?: number) {
    const rows = await this.prisma.localidad.findMany({
      where: departamentoId !== undefined ? { departamentoId } : undefined,
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      departamentoId: r.departamentoId,
    }));
  }

  async zonas(puestoId?: number) {
    const rows = await this.prisma.zona.findMany({
      where: puestoId !== undefined ? { puestoId } : undefined,
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, nombre: r.nombre }));
  }

  async puestos() {
    const rows = await this.prisma.puesto.findMany({
      orderBy: { nombre: 'asc' },
    });
    return rows.map((r) => ({ id: r.id, nombre: r.nombre }));
  }
}
