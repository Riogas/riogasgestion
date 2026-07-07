import { Injectable } from '@nestjs/common';
import { Cobertura } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UpsertInteraccionDto {
  personaId: number;
  puestoId: number;
  empresaFleteraId: number;
  tipo: 'LLAMADA_DIRECTA' | 'ENTREGA_MOVIL';
  fecha: Date;
}

@Injectable()
export class CoberturaService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertInteraccion(p: UpsertInteraccionDto): Promise<Cobertura> {
    const {
      personaId, puestoId, empresaFleteraId, tipo, fecha,
    } = p;

    const where = { personaId_empresaFleteraId: { personaId, empresaFleteraId } };
    const existente = await this.prisma.cobertura.findUnique({ where });

    if (existente) {
      const ultFecha = existente.ultFecha && existente.ultFecha > fecha ? existente.ultFecha : fecha;
      return this.prisma.cobertura.update({
        where,
        data: {
          puestoId,
          tipoInteraccion: tipo,
          ultFecha,
          cantPedidos: (existente.cantPedidos ?? 0) + 1,
        },
      });
    }

    return this.prisma.cobertura.create({
      data: {
        personaId,
        puestoId,
        empresaFleteraId,
        tipoInteraccion: tipo,
        primeraFecha: fecha,
        ultFecha: fecha,
        cantPedidos: 1,
      },
    });
  }

  async tieneAfiliacion(personaId: number, empresaFleteraId: number): Promise<boolean> {
    const existente = await this.prisma.cobertura.findUnique({
      where: { personaId_empresaFleteraId: { personaId, empresaFleteraId } },
    });
    return existente != null;
  }
}
