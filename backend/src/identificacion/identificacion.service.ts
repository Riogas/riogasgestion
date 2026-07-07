import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PersonasService } from '../personas/personas.service';
import { CoberturaService } from '../cobertura/cobertura.service';
import {
  FichaCompleta, FichaRedactada, redactar, Rol,
} from './redaccion';

export interface IdentificarDto {
  identificador: string;
  tipo: 'CEDULA' | 'TELEFONO';
  rol: Rol;
  empresaFleteraId?: number;
}

export interface IdentificarResultado {
  resultado: 'MATCH' | 'SIN_MATCH';
  ficha?: FichaRedactada;
  requiereAltaDireccion?: boolean;
}

@Injectable()
export class IdentificacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly personas: PersonasService,
    private readonly cobertura: CoberturaService,
  ) {}

  async identificar(p: IdentificarDto): Promise<IdentificarResultado> {
    const personaId = await this.buscarPersonaId(p.identificador, p.tipo);
    if (personaId == null) {
      return { resultado: 'SIN_MATCH' };
    }

    let afiliado = false;
    if (p.rol === 'CALL_CENTER') {
      afiliado = true;
    } else if (p.empresaFleteraId != null) {
      afiliado = await this.cobertura.tieneAfiliacion(personaId, p.empresaFleteraId);
    }

    const ficha360 = await this.personas.find360(personaId);
    const fichaCompleta: FichaCompleta = {
      persona: ficha360.persona,
      telefonos: ficha360.telefonos,
      direcciones: ficha360.direcciones,
      hogares: ficha360.hogares,
      observaciones: (ficha360.persona as { notasInternas?: string | null }).notasInternas ?? null,
    };
    const ficha = redactar(fichaCompleta, p.rol, afiliado);

    const requiereAltaDireccion = p.rol === 'DISTRIBUIDOR' && afiliado && !ficha.direccion;

    return {
      resultado: 'MATCH',
      ficha,
      ...(requiereAltaDireccion ? { requiereAltaDireccion: true } : {}),
    };
  }

  private async buscarPersonaId(identificador: string, tipo: 'CEDULA' | 'TELEFONO'): Promise<number | null> {
    if (tipo === 'CEDULA') {
      const persona = await this.prisma.persona.findFirst({ where: { cedula: identificador } });
      return persona?.id ?? null;
    }

    // Un número puede pertenecer a 2..50 clientes (línea familiar/comercial
    // compartida). Solo consideramos teléfonos activos y, si detrás del
    // número hay más de una persona distinta, no adivinamos: SIN_MATCH.
    const telefonos = await this.prisma.clienteTelefono.findMany({
      where: { numero: identificador, estado: 'A' },
    });
    if (telefonos.length === 0) return null;

    const clienteIds = Array.from(new Set(telefonos.map((t) => t.clienteId)));
    const clientes = await this.prisma.clienteUni.findMany({ where: { id: { in: clienteIds } } });
    const personaIds = Array.from(
      new Set(clientes.map((c) => c.personaId).filter((id): id is number => id != null)),
    );

    return personaIds.length === 1 ? personaIds[0] : null;
  }
}
