# Importador Padrón de Clientes (Fase 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir un importador idempotente que lea un archivo dump JSON (generado externamente desde AS400) y haga UPSERT de clientes en Postgres, produciendo un resumen `{ creados, actualizados, errores }`.

**Architecture:** Tres capas: (1) tipo `PadronRow` + función pura de mapeo tolerante a campos faltantes, (2) servicio `ImportPadronService` que orquesta UPSERT idempotente por `nroCliente` usando repositorios TypeORM inyectados, (3) script CLI con `NestFactory.createApplicationContext` que lee el archivo y llama al servicio. Los tests usan mocks de repositorios exactamente igual que `clientes.service.spec.ts`.

**Tech Stack:** NestJS 11, TypeORM 0.3, ts-node, tsconfig-paths, Jest/ts-jest, TypeScript 5.7

---

## File Map

| Archivo | Rol |
|---|---|
| `backend/src/clientes/import/padron-row.ts` | Tipo `PadronRow` + función pura `mapPadronRowToCliente` |
| `backend/src/clientes/import/import-padron.service.ts` | `ImportPadronService` con método `importPadron` |
| `backend/src/clientes/import/import-padron.ts` | Script CLI ejecutable con ts-node |
| `backend/src/clientes/import/import-padron.service.spec.ts` | Tests unitarios (Jest, mocks de repos) |
| `backend/src/clientes/import/README.md` | Instrucciones de uso + shape del dump |
| `backend/src/clientes/clientes.module.ts` | Agregar `ImportPadronService` a providers/exports |
| `backend/package.json` | Agregar script `import:padron` |

---

## Task 1: Tipo PadronRow y función de mapeo pura

**Files:**
- Create: `backend/src/clientes/import/padron-row.ts`

- [ ] **Step 1: Crear el archivo con el tipo y la función de mapeo**

```typescript
// backend/src/clientes/import/padron-row.ts

/**
 * Shape esperado de cada fila del dump legacy (AS400 → JSON).
 * Todos los campos son opcionales para tolerancia máxima.
 *
 * Ejemplo de objeto dump:
 * {
 *   "nroCliente": 1234,
 *   "nombre": "JUAN",
 *   "apellido": "PEREZ",
 *   "rutCi": "1.234.567-8",
 *   "gci": "GCI-001",
 *   "email": "juan@example.com",
 *   "tipo": "DOMESTICO",           // → TipoCliente
 *   "categoria": "RESIDENCIAL",    // → CategoriaCliente
 *   "estado": "ACTIVO",            // → EstadoCliente
 *   "fechaAlta": "2010-05-20",     // ISO 8601 o DD/MM/YYYY
 *   "fechaUltModif": "2023-01-01",
 *   "fechaUltCompra": null,
 *   "telefonos": [
 *     { "numero": "099111222", "tipo": "CELULAR", "esPrincipal": true }
 *   ],
 *   "direcciones": [
 *     {
 *       "calle": "18 DE JULIO",
 *       "nroPuerta": "1234",
 *       "esquina1": "ANDES",
 *       "apto": null,
 *       "zona": "ZONA1",
 *       "departamentoId": 1,
 *       "localidadId": 10,
 *       "esPrincipal": true
 *     }
 *   ]
 * }
 */
export interface PadronRow {
  nroCliente?: number | string | null;
  nombre?: string | null;
  apellido?: string | null;
  rutCi?: string | null;
  gci?: string | null;
  email?: string | null;
  tipo?: string | null;          // → TipoCliente enum
  categoria?: string | null;     // → CategoriaCliente enum
  estado?: string | null;        // → EstadoCliente enum
  fechaAlta?: string | null;
  fechaUltModif?: string | null;
  fechaUltCompra?: string | null;
  telefonos?: PadronTelefono[] | null;
  direcciones?: PadronDireccion[] | null;
  [key: string]: unknown;        // permite campos extra del dump sin romper
}

export interface PadronTelefono {
  numero?: string | null;
  tipo?: string | null;
  alias?: string | null;
  esPrincipal?: boolean | null;
}

export interface PadronDireccion {
  calle?: string | null;
  nroPuerta?: string | null;
  esquina1?: string | null;
  esquina2?: string | null;
  apto?: string | null;
  local?: string | null;
  zona?: string | null;
  departamentoId?: number | null;
  localidadId?: number | null;
  lat?: number | null;
  lng?: number | null;
  nivel?: string | null;
  esPrincipal?: boolean | null;
  enZona?: boolean | null;
}

import { DeepPartial } from 'typeorm';
import { Cliente } from '../entities/cliente.entity';
import { ClienteTelefono } from '../entities/cliente-telefono.entity';
import { ClienteDireccion } from '../entities/cliente-direccion.entity';
import { TipoCliente, CategoriaCliente, EstadoCliente } from '../enums';

/**
 * Parsea una fecha desde string (ISO 8601 o DD/MM/YYYY) de forma segura.
 * Retorna null si el valor es falsy o inválido.
 */
function parseDate(val: string | null | undefined): Date | null {
  if (!val) return null;
  // Intentar DD/MM/YYYY → YYYY-MM-DD
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(val);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    const date = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    return isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(val);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Mapea una fila del dump legacy a DeepPartial<Cliente>.
 * Tolerante: campos faltantes o inválidos se convierten en null/defaults.
 */
export function mapPadronRowToCliente(row: PadronRow): DeepPartial<Cliente> {
  const nroCliente =
    row.nroCliente != null ? Number(row.nroCliente) : null;

  const tipoCliente: TipoCliente =
    row.tipo === TipoCliente.COMERCIAL
      ? TipoCliente.COMERCIAL
      : TipoCliente.DOMESTICO;

  const categoriaValores = Object.values(CategoriaCliente) as string[];
  const categoria: CategoriaCliente | null = row.categoria &&
    categoriaValores.includes(row.categoria.toUpperCase())
    ? (row.categoria.toUpperCase() as CategoriaCliente)
    : null;

  const estadoValores = Object.values(EstadoCliente) as string[];
  const estado: EstadoCliente =
    row.estado && estadoValores.includes(row.estado.toUpperCase())
      ? (row.estado.toUpperCase() as EstadoCliente)
      : EstadoCliente.ACTIVO;

  const telefonos: DeepPartial<ClienteTelefono>[] = (row.telefonos ?? [])
    .filter((t) => !!t.numero)
    .map((t) => ({
      numero: t.numero!.trim(),
      tipo: t.tipo ?? null,
      alias: t.alias ?? null,
      esPrincipal: t.esPrincipal ?? false,
      estado: 'ACTIVO',
    }));

  const direcciones: DeepPartial<ClienteDireccion>[] = (row.direcciones ?? [])
    .filter((d) => !!d.calle)
    .map((d) => ({
      calle: d.calle!.trim(),
      nroPuerta: d.nroPuerta ?? null,
      esquina1: d.esquina1 ?? null,
      esquina2: d.esquina2 ?? null,
      apto: d.apto ?? null,
      local: d.local ?? null,
      zona: d.zona ?? null,
      departamentoId: d.departamentoId ?? null,
      localidadId: d.localidadId ?? null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      nivel: d.nivel ?? null,
      esPrincipal: d.esPrincipal ?? false,
      enZona: d.enZona ?? null,
    }));

  return {
    nroCliente: isNaN(nroCliente as number) ? null : nroCliente,
    nombre: row.nombre?.trim() || 'SIN NOMBRE',
    apellido: row.apellido?.trim() ?? null,
    rutCi: row.rutCi?.trim() ?? null,
    gci: row.gci?.trim() ?? null,
    email: row.email?.trim() ?? null,
    tipoCliente,
    categoria,
    estado,
    fechaAlta: parseDate(row.fechaAlta),
    fechaUltModif: parseDate(row.fechaUltModif),
    fechaUltCompra: parseDate(row.fechaUltCompra),
    telefonos,
    direcciones,
  };
}
```

- [ ] **Step 2: Verificar que el archivo no tiene errores de TypeScript**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

Expected: sin errores (o solo errores pre-existentes en otros archivos).

---

## Task 2: Tests unitarios (TDD — escribe los tests ANTES de implementar el servicio)

**Files:**
- Create: `backend/src/clientes/import/import-padron.service.spec.ts`

- [ ] **Step 1: Escribir el archivo de tests**

```typescript
// backend/src/clientes/import/import-padron.service.spec.ts

import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Cliente } from '../entities/cliente.entity';
import { ClienteTelefono } from '../entities/cliente-telefono.entity';
import { ClienteDireccion } from '../entities/cliente-direccion.entity';
import { mapPadronRowToCliente, PadronRow } from './padron-row';
import { ImportPadronService } from './import-padron.service';
import { EstadoCliente, TipoCliente } from '../enums';

// ─── helpers ─────────────────────────────────────────────────────────────────

const repoMock = () => ({
  findOne: jest.fn(),
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ id: 'gen-uuid', ...x })),
  merge: jest.fn((target, source) => Object.assign(target, source)),
});

// ─── mapPadronRowToCliente (función pura) ─────────────────────────────────────

describe('mapPadronRowToCliente', () => {
  it('mapea campos básicos correctamente', () => {
    const row: PadronRow = {
      nroCliente: 1234,
      nombre: 'JUAN',
      apellido: 'PEREZ',
      rutCi: '1.234.567-8',
      gci: 'GCI-001',
      email: 'juan@example.com',
      tipo: 'DOMESTICO',
      categoria: 'RESIDENCIAL',
      estado: 'ACTIVO',
      fechaAlta: '2010-05-20',
    };
    const result = mapPadronRowToCliente(row);
    expect(result.nroCliente).toBe(1234);
    expect(result.nombre).toBe('JUAN');
    expect(result.apellido).toBe('PEREZ');
    expect(result.rutCi).toBe('1.234.567-8');
    expect(result.gci).toBe('GCI-001');
    expect(result.email).toBe('juan@example.com');
    expect(result.tipoCliente).toBe(TipoCliente.DOMESTICO);
    expect(result.estado).toBe(EstadoCliente.ACTIVO);
    expect(result.fechaAlta).toBeInstanceOf(Date);
  });

  it('tolera campos faltantes: nombre vacío → "SIN NOMBRE", resto null', () => {
    const row: PadronRow = { nroCliente: 99 };
    const result = mapPadronRowToCliente(row);
    expect(result.nombre).toBe('SIN NOMBRE');
    expect(result.apellido).toBeNull();
    expect(result.email).toBeNull();
    expect(result.telefonos).toHaveLength(0);
    expect(result.direcciones).toHaveLength(0);
  });

  it('parsea fecha en formato DD/MM/YYYY', () => {
    const row: PadronRow = { fechaAlta: '20/05/2010' };
    const result = mapPadronRowToCliente(row);
    expect(result.fechaAlta).toBeInstanceOf(Date);
    expect((result.fechaAlta as Date).getUTCFullYear()).toBe(2010);
    expect((result.fechaAlta as Date).getUTCMonth()).toBe(4); // mayo = 4 (0-indexed)
  });

  it('fecha inválida retorna null', () => {
    const row: PadronRow = { fechaAlta: 'not-a-date' };
    const result = mapPadronRowToCliente(row);
    expect(result.fechaAlta).toBeNull();
  });

  it('tipo desconocido → DOMESTICO por defecto', () => {
    const row: PadronRow = { tipo: 'DESCONOCIDO' };
    const result = mapPadronRowToCliente(row);
    expect(result.tipoCliente).toBe(TipoCliente.DOMESTICO);
  });

  it('estado desconocido → ACTIVO por defecto', () => {
    const row: PadronRow = { estado: 'XYZ' };
    const result = mapPadronRowToCliente(row);
    expect(result.estado).toBe(EstadoCliente.ACTIVO);
  });

  it('mapea teléfonos: filtra los que no tienen numero', () => {
    const row: PadronRow = {
      telefonos: [
        { numero: '099111222', tipo: 'CELULAR', esPrincipal: true },
        { numero: null }, // sin numero → debe filtrarse
      ],
    };
    const result = mapPadronRowToCliente(row);
    expect(result.telefonos).toHaveLength(1);
    expect((result.telefonos as any[])[0].numero).toBe('099111222');
    expect((result.telefonos as any[])[0].esPrincipal).toBe(true);
  });

  it('mapea direcciones: filtra las que no tienen calle', () => {
    const row: PadronRow = {
      direcciones: [
        { calle: '18 DE JULIO', nroPuerta: '1234', esPrincipal: true },
        { calle: null }, // sin calle → debe filtrarse
      ],
    };
    const result = mapPadronRowToCliente(row);
    expect(result.direcciones).toHaveLength(1);
    expect((result.direcciones as any[])[0].calle).toBe('18 DE JULIO');
  });

  it('nroCliente como string se convierte a number', () => {
    const row: PadronRow = { nroCliente: '5678' };
    const result = mapPadronRowToCliente(row);
    expect(result.nroCliente).toBe(5678);
  });
});

// ─── ImportPadronService ──────────────────────────────────────────────────────

describe('ImportPadronService', () => {
  let service: ImportPadronService;
  let clientesRepo: ReturnType<typeof repoMock>;
  let telefonosRepo: ReturnType<typeof repoMock>;
  let direccionesRepo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        ImportPadronService,
        { provide: getRepositoryToken(Cliente), useFactory: repoMock },
        { provide: getRepositoryToken(ClienteTelefono), useFactory: repoMock },
        { provide: getRepositoryToken(ClienteDireccion), useFactory: repoMock },
      ],
    }).compile();

    service = mod.get(ImportPadronService);
    clientesRepo = mod.get(getRepositoryToken(Cliente));
    telefonosRepo = mod.get(getRepositoryToken(ClienteTelefono));
    direccionesRepo = mod.get(getRepositoryToken(ClienteDireccion));
  });

  it('CREA cliente cuando no existe nroCliente en DB', async () => {
    clientesRepo.findOne.mockResolvedValue(null);
    clientesRepo.create.mockImplementation((x) => ({ ...x }));
    clientesRepo.save.mockResolvedValue({ id: 'new-uuid', nroCliente: 1, nombre: 'JUAN' });

    const rows: PadronRow[] = [{ nroCliente: 1, nombre: 'JUAN' }];
    const result = await service.importPadron(rows);

    expect(clientesRepo.findOne).toHaveBeenCalledWith({
      where: { nroCliente: 1 },
      relations: { telefonos: true, direcciones: true },
    });
    expect(clientesRepo.create).toHaveBeenCalled();
    expect(clientesRepo.save).toHaveBeenCalled();
    expect(result.creados).toBe(1);
    expect(result.actualizados).toBe(0);
    expect(result.errores).toHaveLength(0);
  });

  it('ACTUALIZA cliente cuando ya existe nroCliente en DB', async () => {
    const existing = {
      id: 'existing-uuid',
      nroCliente: 2,
      nombre: 'VIEJO',
      telefonos: [],
      direcciones: [],
    };
    clientesRepo.findOne.mockResolvedValue(existing);
    clientesRepo.merge.mockImplementation((target, source) => Object.assign(target, source));
    clientesRepo.save.mockResolvedValue({ ...existing, nombre: 'NUEVO' });

    const rows: PadronRow[] = [{ nroCliente: 2, nombre: 'NUEVO' }];
    const result = await service.importPadron(rows);

    expect(clientesRepo.findOne).toHaveBeenCalledWith({
      where: { nroCliente: 2 },
      relations: { telefonos: true, direcciones: true },
    });
    expect(clientesRepo.merge).toHaveBeenCalled();
    expect(clientesRepo.save).toHaveBeenCalled();
    expect(result.creados).toBe(0);
    expect(result.actualizados).toBe(1);
    expect(result.errores).toHaveLength(0);
  });

  it('un row inválido va a errores sin frenar los demás', async () => {
    // Row 1: findOne lanza error inesperado
    // Row 2: debería procesarse normalmente
    clientesRepo.findOne
      .mockRejectedValueOnce(new Error('DB timeout'))
      .mockResolvedValueOnce(null);

    clientesRepo.create.mockImplementation((x) => ({ ...x }));
    clientesRepo.save.mockResolvedValue({ id: 'new-uuid', nroCliente: 3, nombre: 'OK' });

    const rows: PadronRow[] = [
      { nroCliente: 99, nombre: 'FALLA' },
      { nroCliente: 3, nombre: 'OK' },
    ];
    const result = await service.importPadron(rows);

    expect(result.errores).toHaveLength(1);
    expect(result.errores[0].error).toContain('DB timeout');
    expect(result.creados).toBe(1);
  });

  it('row sin nroCliente va a errores (no se puede hacer UPSERT sin clave)', async () => {
    const rows: PadronRow[] = [{ nombre: 'SIN NRO', nroCliente: null }];
    const result = await service.importPadron(rows);
    expect(result.errores).toHaveLength(1);
    expect(result.errores[0].error).toMatch(/nroCliente/i);
    expect(result.creados).toBe(0);
    expect(result.actualizados).toBe(0);
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que FALLAN (aún no hay servicio)**

```bash
cd backend && npx jest src/clientes/import --no-coverage 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module './import-padron.service'`

---

## Task 3: Servicio ImportPadronService

**Files:**
- Create: `backend/src/clientes/import/import-padron.service.ts`

- [ ] **Step 1: Crear el servicio**

```typescript
// backend/src/clientes/import/import-padron.service.ts

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
        // Reemplaza relaciones (simplificado: borra las viejas y pone las nuevas)
        existing.telefonos = (mappedTels ?? []).map((t) => this.telefonos.create(t as any));
        existing.direcciones = (mappedDirs ?? []).map((d) => this.direcciones.create(d as any));
      }
      await this.clientes.save(existing);
      result.actualizados++;
    }
  }
}
```

- [ ] **Step 2: Correr los tests y verificar que PASAN**

```bash
cd backend && npx jest src/clientes/import --no-coverage 2>&1 | tail -30
```

Expected: todos los tests PASS (verde).

- [ ] **Step 3: Verificar TypeScript sin errores**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

Expected: sin errores nuevos.

---

## Task 4: Registrar ImportPadronService en ClientesModule

**Files:**
- Modify: `backend/src/clientes/clientes.module.ts`

- [ ] **Step 1: Agregar ImportPadronService a providers y exports**

Editar `backend/src/clientes/clientes.module.ts`. El archivo actual es:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { ClienteTelefono } from './entities/cliente-telefono.entity';
import { ClienteDireccion } from './entities/cliente-direccion.entity';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, ClienteTelefono, ClienteDireccion])],
  controllers: [ClientesController],
  providers: [ClientesService],
  exports: [ClientesService],
})
export class ClientesModule {}
```

Reemplazar con:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from './entities/cliente.entity';
import { ClienteTelefono } from './entities/cliente-telefono.entity';
import { ClienteDireccion } from './entities/cliente-direccion.entity';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { ImportPadronService } from './import/import-padron.service';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente, ClienteTelefono, ClienteDireccion])],
  controllers: [ClientesController],
  providers: [ClientesService, ImportPadronService],
  exports: [ClientesService, ImportPadronService],
})
export class ClientesModule {}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: sin errores.

---

## Task 5: Script CLI import-padron.ts

**Files:**
- Create: `backend/src/clientes/import/import-padron.ts`

- [ ] **Step 1: Crear el script CLI**

```typescript
// backend/src/clientes/import/import-padron.ts
/**
 * Script CLI para importar el padrón de clientes desde un archivo dump.
 *
 * Uso:
 *   pnpm import:padron --file=padron.json
 *
 * El archivo debe ser un JSON array de PadronRow.
 * CSV: TODO (implementar parser simple cuando se confirme el formato de extracción AS400).
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { ImportPadronService } from './import-padron.service';
import { PadronRow } from './padron-row';

async function main() {
  // ─── Parsear argumentos ───────────────────────────────────────────────────
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith('--file='));

  if (!fileArg) {
    console.error('ERROR: Argumento --file=<ruta> requerido.');
    console.error('  Ejemplo: pnpm import:padron --file=padron.json');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg.replace('--file=', ''));

  if (!fs.existsSync(filePath)) {
    console.error(`ERROR: Archivo no encontrado: ${filePath}`);
    process.exit(1);
  }

  // ─── Leer y parsear el archivo ────────────────────────────────────────────
  const ext = path.extname(filePath).toLowerCase();

  if (ext !== '.json') {
    console.error(`ERROR: Solo se soporta formato JSON por ahora. TODO: soporte CSV.`);
    console.error(`Archivo recibido: ${filePath}`);
    process.exit(1);
  }

  let rows: PadronRow[];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error('ERROR: El archivo JSON debe ser un array de objetos.');
      process.exit(1);
    }
    rows = parsed as PadronRow[];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`ERROR al parsear el archivo: ${msg}`);
    process.exit(1);
  }

  console.log(`Importando ${rows.length} filas desde ${filePath} ...`);

  // ─── Bootstrapear contexto Nest standalone ────────────────────────────────
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const importService = app.get(ImportPadronService);
    const result = await importService.importPadron(rows);

    console.log('\n=== RESULTADO DE IMPORTACIÓN ===');
    console.log(`  Creados:     ${result.creados}`);
    console.log(`  Actualizados: ${result.actualizados}`);
    console.log(`  Errores:     ${result.errores.length}`);

    if (result.errores.length > 0) {
      console.log('\n--- ERRORES ---');
      result.errores.forEach((e, i) => {
        const nro = (e.row as any).nroCliente ?? '(sin nroCliente)';
        console.error(`  [${i + 1}] nroCliente=${nro}: ${e.error}`);
      });
    }

    process.exitCode = result.errores.length > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('ERROR fatal:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Agregar script en backend/package.json**

En `backend/package.json`, agregar dentro de `"scripts"` (después del último script existente, antes del cierre `}`):

```json
"import:padron": "ts-node -r tsconfig-paths/register src/clientes/import/import-padron.ts"
```

El bloque `scripts` completo debe quedar:

```json
"scripts": {
  "prebuild": "node -e \"const fs=require('fs');if(fs.existsSync('dist'))fs.rmSync('dist',{recursive:true})\"",
  "build": "tsc -p tsconfig.build.json",
  "start": "ts-node -r tsconfig-paths/register src/main.ts",
  "start:dev": "ts-node-dev --respawn --transpile-only -r tsconfig-paths/register src/main.ts",
  "start:prod": "node dist/main",
  "lint": "eslint \"{src,apps,libs,test}/**/*.ts\" --fix",
  "format": "prettier --write \"src/**/*.ts\" \"test/**/*.ts\"",
  "test": "jest",
  "test:watch": "jest --watch",
  "test:cov": "jest --coverage",
  "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js",
  "migration:generate": "pnpm typeorm migration:generate -d src/config/data-source.ts",
  "migration:run": "pnpm typeorm migration:run -d src/config/data-source.ts",
  "migration:revert": "pnpm typeorm migration:revert -d src/config/data-source.ts",
  "import:padron": "ts-node -r tsconfig-paths/register src/clientes/import/import-padron.ts"
}
```

- [ ] **Step 3: Verificar TypeScript del script**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: sin errores nuevos.

---

## Task 6: README del importador

**Files:**
- Create: `backend/src/clientes/import/README.md`

- [ ] **Step 1: Crear README**

```markdown
# Importador Padrón de Clientes (Fase 6)

## Dependencia pendiente externa

La **extracción desde AS400** (generar el archivo dump) es responsabilidad de un proceso externo que aún no está disponible. Este importador estará listo para correr en cuanto exista el archivo dump en formato JSON.

## Cómo correr

```bash
cd backend
pnpm import:padron --file=/ruta/al/padron.json
```

## Formato del dump JSON

El archivo debe ser un **array JSON** donde cada elemento es un objeto con la siguiente forma:

```json
[
  {
    "nroCliente": 1234,
    "nombre": "JUAN",
    "apellido": "PEREZ",
    "rutCi": "1.234.567-8",
    "gci": "GCI-001",
    "email": "juan@example.com",
    "tipo": "DOMESTICO",
    "categoria": "RESIDENCIAL",
    "estado": "ACTIVO",
    "fechaAlta": "2010-05-20",
    "fechaUltModif": "2023-01-01",
    "fechaUltCompra": null,
    "telefonos": [
      { "numero": "099111222", "tipo": "CELULAR", "esPrincipal": true }
    ],
    "direcciones": [
      {
        "calle": "18 DE JULIO",
        "nroPuerta": "1234",
        "esquina1": "ANDES",
        "zona": "ZONA1",
        "departamentoId": 1,
        "localidadId": 10,
        "esPrincipal": true
      }
    ]
  }
]
```

### Campos y tolerancias

| Campo | Tipo | Requerido | Default si ausente |
|---|---|---|---|
| `nroCliente` | number \| string | **SÍ** (clave UPSERT) | error → row a errores |
| `nombre` | string | No | `"SIN NOMBRE"` |
| `apellido` | string | No | `null` |
| `rutCi` | string | No | `null` |
| `gci` | string | No | `null` |
| `email` | string | No | `null` |
| `tipo` | `"DOMESTICO"` \| `"COMERCIAL"` | No | `"DOMESTICO"` |
| `categoria` | `"RESIDENCIAL"` \| `"COMERCIAL"` \| `"INDUSTRIAL"` | No | `null` |
| `estado` | `"ACTIVO"` \| `"INACTIVO"` \| `"PENDIENTE"` | No | `"ACTIVO"` |
| `fechaAlta` | string ISO 8601 o DD/MM/YYYY | No | `null` |
| `telefonos[].numero` | string | **SÍ para incluir el tel.** | teléfono filtrado |
| `direcciones[].calle` | string | **SÍ para incluir la dir.** | dirección filtrada |

## Idempotencia

- Si ya existe un cliente con ese `nroCliente` → **UPDATE** (merge de campos + reemplazo de relaciones).
- Si no existe → **CREATE**.
- Un row con error no frena los demás; se acumula en la lista de errores.

## Salida esperada

```
Importando 5000 filas desde /ruta/padron.json ...

=== RESULTADO DE IMPORTACIÓN ===
  Creados:      4800
  Actualizados: 150
  Errores:      50

--- ERRORES ---
  [1] nroCliente=9999: nroCliente requerido para UPSERT ...
  ...
```

Exit code 0 si no hay errores, 1 si hubo alguno.

## TODO

- [ ] Soporte CSV: acordar separador y columnas con el extractor AS400, luego implementar parser simple sin dependencias nuevas.
```

---

## Task 7: Verificación final y commit

**Files:** (ninguno nuevo)

- [ ] **Step 1: Correr todos los tests del módulo import**

```bash
cd backend && npx jest src/clientes/import --no-coverage --verbose 2>&1
```

Expected: todos los tests PASS (al menos 13 tests: 9 de `mapPadronRowToCliente` + 4 de `ImportPadronService`).

- [ ] **Step 2: Verificar TypeScript completo**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json 2>&1
```

Expected: 0 errores nuevos.

- [ ] **Step 3: Verificar tests existentes siguen pasando**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

Expected: todos los tests previos siguen en verde.

- [ ] **Step 4: Commit en rama dev**

```bash
git -C "C:/Users/jgomez/Documents/Projects/gestiondefinitivo/riogasgestion" add \
  backend/src/clientes/import/padron-row.ts \
  backend/src/clientes/import/import-padron.service.ts \
  backend/src/clientes/import/import-padron.service.spec.ts \
  backend/src/clientes/import/import-padron.ts \
  backend/src/clientes/import/README.md \
  backend/src/clientes/clientes.module.ts \
  backend/package.json
```

```bash
git -C "C:/Users/jgomez/Documents/Projects/gestiondefinitivo/riogasgestion" commit -m "feat(backend): importador idempotente del padrón de clientes desde dump (Fase 6, pendiente fuente AS400)"
```

Expected: commit con SHA visible. NO hacer push.

---

## Self-Review

### Spec coverage check

| Requerimiento | Task |
|---|---|
| `padron-row.ts` con tipo `PadronRow` y función `mapPadronRowToCliente` | Task 1 |
| Mapeo tolerante (campos faltantes → null/defaults) | Task 1 (función `parseDate`, defaults en mapeo) |
| Fechas parseadas de forma segura | Task 1 (`parseDate` soporta ISO y DD/MM/YYYY) |
| Servicio `importPadron` con UPSERT idempotente por `nroCliente` | Task 3 |
| Resumen `{ creados, actualizados, errores }` | Task 3 |
| No explota por un row malo (acumula y sigue) | Task 3 (`try/catch` por row) |
| Script CLI con `--file=` | Task 5 |
| Soporte JSON | Task 5 |
| Soporte CSV → documentado como TODO | Task 5 y Task 6 |
| Bootstrap standalone `NestFactory.createApplicationContext` | Task 5 |
| Script `import:padron` en `package.json` | Task 5 |
| Tests: mapea campos | Task 2 |
| Tests: tolera campos faltantes | Task 2 |
| Tests: crea cuando no existe nroCliente | Task 2 |
| Tests: actualiza cuando existe | Task 2 |
| Tests: row inválido → errores sin frenar los demás | Task 2 |
| Tests: sigue patrón de `clientes.service.spec.ts` (mock repos con `getRepositoryToken`) | Task 2 |
| README con instrucciones, shape del dump, y dependencia AS400 | Task 6 |
| `ImportPadronService` registrado en `ClientesModule` | Task 4 |
| Commit en `dev` con mensaje exacto | Task 7 |

### Placeholders scan

Ningún "TBD", "TODO" sin contexto, ni "similar a Task N" encontrado. El único TODO es el soporte CSV que está explícitamente documentado como dependencia futura.

### Type consistency

- `PadronRow`, `PadronTelefono`, `PadronDireccion` definidos en Task 1, usados consistentemente en Tasks 2 y 3.
- `ImportPadronResult` definido en Task 3, retornado por `importPadron`.
- `mapPadronRowToCliente` definida en Task 1, importada en Task 3 y en tests de Task 2.
- `ImportPadronService` definido en Task 3, registrado en Task 4, usado en Task 5.
