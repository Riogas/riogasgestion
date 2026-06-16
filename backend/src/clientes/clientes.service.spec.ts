import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { Cliente } from './entities/cliente.entity';
import { ClienteTelefono } from './entities/cliente-telefono.entity';
import { ClienteDireccion } from './entities/cliente-direccion.entity';
import { EstadoCliente } from './enums';

const repoMock = () => ({
  create: jest.fn((x) => x),
  save: jest.fn((x) => Promise.resolve({ id: 'c1', ...x })),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  delete: jest.fn(),
});

describe('ClientesService', () => {
  let service: ClientesService;
  let clientes: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        ClientesService,
        { provide: getRepositoryToken(Cliente), useFactory: repoMock },
        { provide: getRepositoryToken(ClienteTelefono), useFactory: repoMock },
        { provide: getRepositoryToken(ClienteDireccion), useFactory: repoMock },
      ],
    }).compile();
    service = mod.get(ClientesService);
    clientes = mod.get(getRepositoryToken(Cliente));
  });

  it('create asigna estado ACTIVO y fechas por defecto', async () => {
    const res = await service.create({ nombre: 'Juan' } as any);
    expect(clientes.save).toHaveBeenCalled();
    expect(res.estado).toBe(EstadoCliente.ACTIVO);
    expect(res.fechaAlta).toBeInstanceOf(Date);
  });

  it('findOne lanza NotFound si no existe', async () => {
    clientes.findOne.mockResolvedValue(null);
    await expect(service.findOne('x')).rejects.toThrow(NotFoundException);
  });

  it('findOne trae relaciones de telefonos y direcciones', async () => {
    clientes.findOne.mockResolvedValue({ id: 'c1' });
    await service.findOne('c1');
    expect(clientes.findOne).toHaveBeenCalledWith({
      where: { id: 'c1' },
      relations: { telefonos: true, direcciones: true },
    });
  });

  it('findAll pagina con skip/take y devuelve total', async () => {
    clientes.findAndCount.mockResolvedValue([[{ id: 'c1' }], 1]);
    const res = await service.findAll({ page: 2, pageSize: 10 } as any);
    expect(clientes.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(res).toEqual({ data: [{ id: 'c1' }], total: 1, page: 2, pageSize: 10 });
  });

  it('update mergea campos y actualiza fechaUltModif', async () => {
    clientes.findOne.mockResolvedValue({ id: 'c1', nombre: 'Viejo' });
    const res = await service.update('c1', { nombre: 'Nuevo' } as any);
    expect(res.nombre).toBe('Nuevo');
    expect(res.fechaUltModif).toBeInstanceOf(Date);
  });

  it('remove hace baja lógica (estado INACTIVO)', async () => {
    clientes.findOne.mockResolvedValue({ id: 'c1', estado: EstadoCliente.ACTIVO });
    const res = await service.remove('c1');
    expect(res).toEqual({ id: 'c1', estado: EstadoCliente.INACTIVO });
    expect(clientes.save).toHaveBeenCalled();
  });

  it('addTelefono valida que el cliente exista y guarda el teléfono', async () => {
    clientes.findOne.mockResolvedValue({ id: 'c1' });
    const telefonos = (service as any).telefonos as ReturnType<typeof repoMock>;
    telefonos.save.mockResolvedValue({ id: 't1', numero: '099' });
    const res = await service.addTelefono('c1', { numero: '099' } as any);
    expect(clientes.findOne).toHaveBeenCalled();
    expect(res).toEqual({ id: 't1', numero: '099' });
  });

  it('removeTelefono lanza NotFound si no afecta filas', async () => {
    const telefonos = (service as any).telefonos as ReturnType<typeof repoMock>;
    telefonos.delete.mockResolvedValue({ affected: 0 });
    await expect(service.removeTelefono('c1', 'tX')).rejects.toThrow(NotFoundException);
  });

  it('addDireccion guarda la dirección ligada al cliente', async () => {
    clientes.findOne.mockResolvedValue({ id: 'c1' });
    const direcciones = (service as any).direcciones as ReturnType<typeof repoMock>;
    direcciones.save.mockResolvedValue({ id: 'd1', calle: 'Artigas' });
    const res = await service.addDireccion('c1', { calle: 'Artigas' } as any);
    expect(res).toEqual({ id: 'd1', calle: 'Artigas' });
  });
});
