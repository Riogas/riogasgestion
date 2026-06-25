import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductoInputDto } from './dto/producto-input.dto';

// CRUD de "Recarga y productos" → movil_stock.
@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async add(movilId: number, dto: ProductoInputDto) {
    const movil = await this.assertMovil(movilId);
    return this.prisma.movilStock.create({
      data: { movilId, origen: movil.origen, ...this.mapData(dto) },
    });
  }

  async update(movilId: number, stockId: number, dto: ProductoInputDto) {
    await this.assertStock(movilId, stockId);
    return this.prisma.movilStock.update({
      where: { id: stockId },
      data: this.mapData(dto),
    });
  }

  async remove(movilId: number, stockId: number) {
    await this.assertStock(movilId, stockId);
    await this.prisma.movilStock.delete({ where: { id: stockId } });
    return { id: stockId, deleted: true };
  }

  private mapData(d: ProductoInputDto) {
    return {
      productoEmpresa: d.productoEmpresa,
      productoCodigo: d.productoCodigo,
      stockMovil: d.stockMin,
      stockOcupado: d.stockDps,
      tiempoCarga: d.tiempoCarga,
      tiempoDescarga: d.tiempoDescarga,
    };
  }

  private async assertMovil(movilId: number) {
    const m = await this.prisma.movil.findUnique({ where: { id: movilId } });
    if (!m) throw new NotFoundException(`Móvil ${movilId} no encontrado`);
    return m;
  }

  private async assertStock(movilId: number, stockId: number) {
    const s = await this.prisma.movilStock.findUnique({ where: { id: stockId } });
    if (!s || s.movilId !== movilId) {
      throw new NotFoundException(`Producto ${stockId} no encontrado`);
    }
    return s;
  }
}
