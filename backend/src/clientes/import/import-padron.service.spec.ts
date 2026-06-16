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
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
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
    // Verifica que las relaciones huérfanas se borran antes de reemplazarlas
    expect(telefonosRepo.delete).toHaveBeenCalledWith({ cliente: { id: 'existing-uuid' } });
    expect(direccionesRepo.delete).toHaveBeenCalledWith({ cliente: { id: 'existing-uuid' } });
    expect(clientesRepo.save).toHaveBeenCalled();
    expect(result.creados).toBe(0);
    expect(result.actualizados).toBe(1);
    expect(result.errores).toHaveLength(0);
  });

  it('un row inválido va a errores sin frenar los demás', async () => {
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
