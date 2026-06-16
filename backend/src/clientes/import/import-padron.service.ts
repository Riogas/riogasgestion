import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from '../entities/cliente.entity';
import { ClienteTelefono } from '../entities/cliente-telefono.entity';
import { ClienteDireccion } from '../entities/cliente-direccion.entity';
import { mapPadronRowToCliente, PadronRow } from './padron-row';

export interface ImportPadronOptions {
  /** Si true, omite el update de relaciones (telefonos/direcciones) en clientes existentes. Default: false */
  skipRelationsOnUpdate?: boolean;
}

export interface ImportPadronResult {
  creados: number;
  actualizados: number;
  errores: Array<{ row: PadronRow; error: string }>;
}

@Injectable()
export class ImportPadronService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clientes: Repository<Cliente>,
    @InjectRepository(ClienteTelefono)
    private readonly telefonos: Repository<ClienteTelefono>,
    @InjectRepository(ClienteDireccion)
    private readonly direcciones: Repository<ClienteDireccion>,
  ) {}

  async importPadron(
    rows: PadronRow[],
    opts: ImportPadronOptions = {},
  ): Promise<ImportPadronResult> {
    const result: ImportPadronResult = { creados: 0, actualizados: 0, errores: [] };

    for (const row of rows) {
      try {
        await this.processRow(row, opts, result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errores.push({ row, error: msg });
      }
    }

    return result;
  }

  private async processRow(
    row: PadronRow,
    opts: ImportPadronOptions,
    result: ImportPadronResult,
  ): Promise<void> {
    const mapped = mapPadronRowToCliente(row);

    // Validación: nroCliente es la clave de idempotencia
    if (mapped.nroCliente == null) {
      throw new Error(`nroCliente requerido para UPSERT (row: ${JSON.stringify(row)})`);
    }

    const existing = await this.clientes.findOne({
      where: { nroCliente: mapped.nroCliente },
      relations: { telefonos: true, direcciones: true },
    });

    const { telefonos: mappedTels, direcciones: mappedDirs, ...clienteFields } = mapped;

    if (!existing) {
      // CREATE
      const telefonoEntities = (mappedTels ?? []).map((t) => this.telefonos.create(t as any));
      const direccionEntidades = (mappedDirs ?? []).map((d) => this.direcciones.create(d as any));
      const newCliente = this.clientes.create({
        ...clienteFields,
        telefonos: telefonoEntities,
        direcciones: direccionEntidades,
      } as any);
      await this.clientes.save(newCliente);
      result.creados++;
    } else {
      // UPDATE
      this.clientes.merge(existing, clienteFields as any);
      if (!opts.skipRelationsOnUpdate) {
        // Borrar relaciones huérfanas antes de reemplazarlas para evitar duplicados en re-imports
        await this.telefonos.delete({ cliente: { id: existing.id } });
        await this.direcciones.delete({ cliente: { id: existing.id } });
        existing.telefonos = (mappedTels ?? []).map(
          (t) => this.telefonos.create(t as any) as unknown as ClienteTelefono,
        );
        existing.direcciones = (mappedDirs ?? []).map(
          (d) => this.direcciones.create(d as any) as unknown as ClienteDireccion,
        );
      }
      await this.clientes.save(existing);
      result.actualizados++;
    }
  }
}
