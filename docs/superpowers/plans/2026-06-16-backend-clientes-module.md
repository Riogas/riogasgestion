# Backend — Módulo de Clientes (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el módulo de clientes en el backend NestJS (entidades + CRUD + sub-recursos de teléfonos/direcciones + auth guard), que es la capa de datos que desbloquea toda la reconstrucción de la ficha.

**Architecture:** NestJS 11 + TypeORM 0.3 sobre PostgreSQL. Un `ClientesModule` con tres entidades (`Cliente`, `ClienteTelefono`, `ClienteDireccion`) relacionadas por `OneToMany`/`ManyToOne` con cascade. Un `ClientesService` con repositorios inyectados implementa el CRUD y los sub-recursos. Un `AuthGuard` (decodifica el JWT del header `Authorization: Bearer`, igual que hace hoy el proxy del frontend) protege el controller. Los tests son unitarios con repositorios mockeados vía `@nestjs/testing` — no requieren base de datos.

**Tech Stack:** NestJS 11, TypeORM 0.3, class-validator/class-transformer, @nestjs/swagger (PartialType/OmitType), jest + ts-jest, uuid.

**Scope note / desviación del spec:** Los endpoints `/direcciones/autocompletar` y `/direcciones/validar-zona` NO se incluyen en esta fase. La lógica de zona (turf + capas) y el padrón de calles viven hoy en el frontend vía el proxy legacy; se reutilizan client-side hasta una fase posterior. Los endpoints placeholder `/clientes/:id/{pedidos,servicios,cuenta}` pertenecen a la Fase 5.

**Working dir:** Todos los comandos se ejecutan desde `backend/` salvo que se indique. Rama: `dev`.

---

### Task 1: Entidades y enums

**Files:**
- Create: `backend/src/clientes/enums.ts`
- Create: `backend/src/clientes/entities/cliente.entity.ts`
- Create: `backend/src/clientes/entities/cliente-telefono.entity.ts`
- Create: `backend/src/clientes/entities/cliente-direccion.entity.ts`

Las entidades no tienen comportamiento testeable de forma aislada; su validación ocurre a nivel de `ClientesService` (Task 4-5). Por eso esta tarea no es TDD.

- [ ] **Step 1: Crear los enums**

`backend/src/clientes/enums.ts`:
```ts
export enum TipoCliente {
  DOMESTICO = 'DOMESTICO',
  COMERCIAL = 'COMERCIAL',
}

export enum CategoriaCliente {
  RESIDENCIAL = 'RESIDENCIAL',
  COMERCIAL = 'COMERCIAL',
  INDUSTRIAL = 'INDUSTRIAL',
}

export enum EstadoCliente {
  ACTIVO = 'ACTIVO',
  INACTIVO = 'INACTIVO',
  PENDIENTE = 'PENDIENTE',
}
```

- [ ] **Step 2: Crear la entidad Cliente**

`backend/src/clientes/entities/cliente.entity.ts`:
```ts
import {
  Entity, PrimaryGeneratedColumn, Column, OneToMany,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { TipoCliente, CategoriaCliente, EstadoCliente } from '../enums';
import { ClienteTelefono } from './cliente-telefono.entity';
import { ClienteDireccion } from './cliente-direccion.entity';

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'nro_cliente', type: 'int', nullable: true })
  nroCliente: number | null;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  apellido: string | null;

  @Column({ name: 'tipo_cliente', type: 'enum', enum: TipoCliente, default: TipoCliente.DOMESTICO })
  tipoCliente: TipoCliente;

  @Column({ type: 'enum', enum: CategoriaCliente, nullable: true })
  categoria: CategoriaCliente | null;

  @Column({ name: 'rut_ci', type: 'varchar', length: 32, nullable: true })
  rutCi: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  gci: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  privilegio: string | null;

  @Column({ name: 'obs_cliente', type: 'text', nullable: true })
  obsCliente: string | null;

  @Column({ name: 'obs_general', type: 'text', nullable: true })
  obsGeneral: string | null;

  @Column({ name: 'obs_comercial', type: 'text', nullable: true })
  obsComercial: string | null;

  @Column({ type: 'enum', enum: EstadoCliente, default: EstadoCliente.ACTIVO })
  estado: EstadoCliente;

  @Column({ name: 'fecha_alta', type: 'timestamptz', nullable: true })
  fechaAlta: Date | null;

  @Column({ name: 'fecha_ult_modif', type: 'timestamptz', nullable: true })
  fechaUltModif: Date | null;

  @Column({ name: 'fecha_ult_compra', type: 'timestamptz', nullable: true })
  fechaUltCompra: Date | null;

  @OneToMany(() => ClienteTelefono, (t) => t.cliente, { cascade: true, eager: false })
  telefonos: ClienteTelefono[];

  @OneToMany(() => ClienteDireccion, (d) => d.cliente, { cascade: true, eager: false })
  direcciones: ClienteDireccion[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

- [ ] **Step 3: Crear la entidad ClienteTelefono**

`backend/src/clientes/entities/cliente-telefono.entity.ts`:
```ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Cliente } from './cliente.entity';

@Entity('cliente_telefonos')
export class ClienteTelefono {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40 })
  numero: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  alias: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  tipo: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVO' })
  estado: string;

  @Column({ name: 'es_principal', type: 'boolean', default: false })
  esPrincipal: boolean;

  @ManyToOne(() => Cliente, (c) => c.telefonos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;
}
```

- [ ] **Step 4: Crear la entidad ClienteDireccion**

`backend/src/clientes/entities/cliente-direccion.entity.ts`:
```ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Cliente } from './cliente.entity';

@Entity('cliente_direcciones')
export class ClienteDireccion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  calle: string;

  @Column({ name: 'nro_puerta', type: 'varchar', length: 20, nullable: true })
  nroPuerta: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  esquina1: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  esquina2: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  apto: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  local: string | null;

  @Column({ name: 'departamento_id', type: 'int', nullable: true })
  departamentoId: number | null;

  @Column({ name: 'localidad_id', type: 'int', nullable: true })
  localidadId: number | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  zona: string | null;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lng: number | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  nivel: string | null;

  @Column({ name: 'es_principal', type: 'boolean', default: false })
  esPrincipal: boolean;

  @Column({ name: 'en_zona', type: 'boolean', nullable: true })
  enZona: boolean | null;

  @ManyToOne(() => Cliente, (c) => c.direcciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;
}
```

- [ ] **Step 5: Verificar que compila**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores (exit 0). Si aparece "Cannot find name" por imports circulares entre entidades, verificá que las relaciones usen funciones flecha (`() => ClienteTelefono`), que ya está así.

- [ ] **Step 6: Commit**

```bash
git add backend/src/clientes/enums.ts backend/src/clientes/entities/
git commit -m "feat(backend): entidades Cliente, ClienteTelefono, ClienteDireccion"
```

---

### Task 2: AuthGuard (TDD)

**Files:**
- Create: `backend/src/common/guards/auth.guard.ts`
- Test: `backend/src/common/guards/auth.guard.spec.ts`

El guard decodifica el payload del JWT del header `Authorization: Bearer <token>` (sin verificar la firma — mismo enfoque que `src/proxy.ts` en el frontend), rechaza si falta o está expirado, y adjunta el payload a `req.user`.

- [ ] **Step 1: Escribir el test que falla**

`backend/src/common/guards/auth.guard.spec.ts`:
```ts
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard, decodeJwtPayload } from './auth.guard';

function makeToken(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `eyJhbGciOiJIUzI1NiJ9.${body}.firma`;
}

function ctx(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const guard = new AuthGuard();

  it('rechaza cuando no hay header Authorization', () => {
    expect(() => guard.canActivate(ctx({}))).toThrow(UnauthorizedException);
  });

  it('rechaza cuando el token está expirado', () => {
    const token = makeToken({ sub: 'u1', exp: 1000 }); // 1970, expirado
    expect(() => guard.canActivate(ctx({ authorization: `Bearer ${token}` }))).toThrow(
      UnauthorizedException,
    );
  });

  it('acepta un token válido no expirado y adjunta el payload', () => {
    const token = makeToken({ sub: 'u1', exp: 32503680000 }); // año 3000
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    const context = { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
    expect(req.user.sub).toBe('u1');
  });

  it('decodeJwtPayload devuelve null ante basura', () => {
    expect(decodeJwtPayload('no-es-un-jwt')).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest src/common/guards/auth.guard.spec.ts`
Expected: FAIL con "Cannot find module './auth.guard'".

- [ ] **Step 3: Implementar el guard**

`backend/src/common/guards/auth.guard.ts`:
```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

export function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header: string | undefined = req.headers?.['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }
    const token = header.slice('Bearer '.length).trim();
    const payload = decodeJwtPayload(token);
    if (!payload) {
      throw new UnauthorizedException('Token inválido');
    }
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Token expirado');
    }
    req.user = payload;
    return true;
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx jest src/common/guards/auth.guard.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/guards/auth.guard.ts backend/src/common/guards/auth.guard.spec.ts
git commit -m "feat(backend): AuthGuard que valida el JWT del header Authorization"
```

---

### Task 3: DTOs

**Files:**
- Create: `backend/src/clientes/dto/create-telefono.dto.ts`
- Create: `backend/src/clientes/dto/update-telefono.dto.ts`
- Create: `backend/src/clientes/dto/create-direccion.dto.ts`
- Create: `backend/src/clientes/dto/update-direccion.dto.ts`
- Create: `backend/src/clientes/dto/create-cliente.dto.ts`
- Create: `backend/src/clientes/dto/update-cliente.dto.ts`
- Create: `backend/src/clientes/dto/query-clientes.dto.ts`

- [ ] **Step 1: DTOs de teléfono**

`backend/src/clientes/dto/create-telefono.dto.ts`:
```ts
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTelefonoDto {
  @IsString()
  @MaxLength(40)
  numero: string;

  @IsOptional() @IsString() @MaxLength(60)
  alias?: string;

  @IsOptional() @IsString() @MaxLength(40)
  tipo?: string;

  @IsOptional() @IsString() @MaxLength(20)
  estado?: string;

  @IsOptional() @IsBoolean()
  esPrincipal?: boolean;
}
```

`backend/src/clientes/dto/update-telefono.dto.ts`:
```ts
import { PartialType } from '@nestjs/swagger';
import { CreateTelefonoDto } from './create-telefono.dto';

export class UpdateTelefonoDto extends PartialType(CreateTelefonoDto) {}
```

- [ ] **Step 2: DTOs de dirección**

`backend/src/clientes/dto/create-direccion.dto.ts`:
```ts
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDireccionDto {
  @IsString() @MaxLength(160)
  calle: string;

  @IsOptional() @IsString() @MaxLength(20)
  nroPuerta?: string;

  @IsOptional() @IsString() @MaxLength(160)
  esquina1?: string;

  @IsOptional() @IsString() @MaxLength(160)
  esquina2?: string;

  @IsOptional() @IsString() @MaxLength(40)
  apto?: string;

  @IsOptional() @IsString() @MaxLength(60)
  local?: string;

  @IsOptional() @IsInt()
  departamentoId?: number;

  @IsOptional() @IsInt()
  localidadId?: number;

  @IsOptional() @IsString() @MaxLength(80)
  zona?: string;

  @IsOptional() @IsNumber()
  lat?: number;

  @IsOptional() @IsNumber()
  lng?: number;

  @IsOptional() @IsString() @MaxLength(40)
  nivel?: string;

  @IsOptional() @IsBoolean()
  esPrincipal?: boolean;

  @IsOptional() @IsBoolean()
  enZona?: boolean;
}
```

`backend/src/clientes/dto/update-direccion.dto.ts`:
```ts
import { PartialType } from '@nestjs/swagger';
import { CreateDireccionDto } from './create-direccion.dto';

export class UpdateDireccionDto extends PartialType(CreateDireccionDto) {}
```

- [ ] **Step 3: DTO de creación de cliente (con nested)**

`backend/src/clientes/dto/create-cliente.dto.ts`:
```ts
import { Type } from 'class-transformer';
import {
  IsArray, IsEmail, IsEnum, IsInt, IsOptional, IsString, MaxLength, ValidateNested,
} from 'class-validator';
import { TipoCliente, CategoriaCliente, EstadoCliente } from '../enums';
import { CreateTelefonoDto } from './create-telefono.dto';
import { CreateDireccionDto } from './create-direccion.dto';

export class CreateClienteDto {
  @IsOptional() @IsInt()
  nroCliente?: number;

  @IsString() @MaxLength(120)
  nombre: string;

  @IsOptional() @IsString() @MaxLength(120)
  apellido?: string;

  @IsOptional() @IsEnum(TipoCliente)
  tipoCliente?: TipoCliente;

  @IsOptional() @IsEnum(CategoriaCliente)
  categoria?: CategoriaCliente;

  @IsOptional() @IsString() @MaxLength(32)
  rutCi?: string;

  @IsOptional() @IsString() @MaxLength(32)
  gci?: string;

  @IsOptional() @IsEmail() @MaxLength(160)
  email?: string;

  @IsOptional() @IsString() @MaxLength(60)
  privilegio?: string;

  @IsOptional() @IsString()
  obsCliente?: string;

  @IsOptional() @IsString()
  obsGeneral?: string;

  @IsOptional() @IsString()
  obsComercial?: string;

  @IsOptional() @IsEnum(EstadoCliente)
  estado?: EstadoCliente;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateTelefonoDto)
  telefonos?: CreateTelefonoDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateDireccionDto)
  direcciones?: CreateDireccionDto[];
}
```

- [ ] **Step 4: DTO de update (escalares, sin nested)**

`backend/src/clientes/dto/update-cliente.dto.ts`:
```ts
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateClienteDto } from './create-cliente.dto';

// Update parcial de campos escalares. Teléfonos y direcciones se manejan
// por sus sub-recursos (no se reemplazan con el PATCH del cliente).
export class UpdateClienteDto extends PartialType(
  OmitType(CreateClienteDto, ['telefonos', 'direcciones'] as const),
) {}
```

- [ ] **Step 5: DTO de query (lista)**

`backend/src/clientes/dto/query-clientes.dto.ts`:
```ts
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TipoCliente, EstadoCliente } from '../enums';

export class QueryClientesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  pageSize?: number;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsEnum(EstadoCliente)
  estado?: EstadoCliente;

  @IsOptional() @IsEnum(TipoCliente)
  tipoCliente?: TipoCliente;
}
```

- [ ] **Step 6: Verificar que compila y commit**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

```bash
git add backend/src/clientes/dto/
git commit -m "feat(backend): DTOs de clientes, telefonos, direcciones y query"
```

---

### Task 4: ClientesService — CRUD de cliente (TDD)

**Files:**
- Create: `backend/src/clientes/clientes.service.ts`
- Test: `backend/src/clientes/clientes.service.spec.ts`

- [ ] **Step 1: Escribir el test que falla**

`backend/src/clientes/clientes.service.spec.ts`:
```ts
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
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd backend && npx jest src/clientes/clientes.service.spec.ts`
Expected: FAIL con "Cannot find module './clientes.service'".

- [ ] **Step 3: Implementar el service (CRUD)**

`backend/src/clientes/clientes.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Cliente } from './entities/cliente.entity';
import { ClienteTelefono } from './entities/cliente-telefono.entity';
import { ClienteDireccion } from './entities/cliente-direccion.entity';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';
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
    const cliente = this.clientes.create({
      ...dto,
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
}
```

> Nota: `findOne` en el test de `update`/`remove` se mockea para devolver un objeto plano; `Object.assign` y la asignación de estado operan sobre ese objeto. El mock de `save` resuelve el mismo objeto, por eso el `res` refleja los cambios.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd backend && npx jest src/clientes/clientes.service.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/clientes/clientes.service.ts backend/src/clientes/clientes.service.spec.ts
git commit -m "feat(backend): ClientesService con CRUD y baja lógica"
```

---

### Task 5: ClientesService — sub-recursos teléfonos y direcciones (TDD)

**Files:**
- Modify: `backend/src/clientes/clientes.service.ts`
- Modify: `backend/src/clientes/clientes.service.spec.ts`

- [ ] **Step 1: Agregar los tests que fallan**

Añadir al final del `describe('ClientesService', ...)` en `clientes.service.spec.ts` (antes del `});` de cierre):
```ts
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
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `cd backend && npx jest src/clientes/clientes.service.spec.ts`
Expected: FAIL con "service.addTelefono is not a function".

- [ ] **Step 3: Implementar los métodos de sub-recursos**

Agregar estos imports al inicio de `clientes.service.ts` (junto a los DTOs ya importados):
```ts
import { CreateTelefonoDto } from './dto/create-telefono.dto';
import { UpdateTelefonoDto } from './dto/update-telefono.dto';
import { CreateDireccionDto } from './dto/create-direccion.dto';
import { UpdateDireccionDto } from './dto/update-direccion.dto';
```

Agregar estos métodos dentro de la clase `ClientesService` (después de `remove`):
```ts
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
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `cd backend && npx jest src/clientes/clientes.service.spec.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/clientes/clientes.service.ts backend/src/clientes/clientes.service.spec.ts
git commit -m "feat(backend): sub-recursos de telefonos y direcciones en ClientesService"
```

---

### Task 6: ClientesController

**Files:**
- Create: `backend/src/clientes/clientes.controller.ts`

El controller no agrega lógica (delega 1:1 al service ya testeado), por eso se cubre con los tests del service + el spec del guard. No requiere spec propio.

- [ ] **Step 1: Crear el controller**

`backend/src/clientes/clientes.controller.ts`:
```ts
import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { QueryClientesDto } from './dto/query-clientes.dto';
import { CreateTelefonoDto } from './dto/create-telefono.dto';
import { UpdateTelefonoDto } from './dto/update-telefono.dto';
import { CreateDireccionDto } from './dto/create-direccion.dto';
import { UpdateDireccionDto } from './dto/update-direccion.dto';

@ApiTags('clientes')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Get()
  findAll(@Query() query: QueryClientesDto) {
    return this.clientes.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateClienteDto) {
    return this.clientes.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClienteDto) {
    return this.clientes.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientes.remove(id);
  }

  // --- Teléfonos ---
  @Post(':id/telefonos')
  addTelefono(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTelefonoDto) {
    return this.clientes.addTelefono(id, dto);
  }

  @Patch(':id/telefonos/:telId')
  updateTelefono(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('telId', ParseUUIDPipe) telId: string,
    @Body() dto: UpdateTelefonoDto,
  ) {
    return this.clientes.updateTelefono(id, telId, dto);
  }

  @Delete(':id/telefonos/:telId')
  removeTelefono(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('telId', ParseUUIDPipe) telId: string,
  ) {
    return this.clientes.removeTelefono(id, telId);
  }

  // --- Direcciones ---
  @Post(':id/direcciones')
  addDireccion(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateDireccionDto) {
    return this.clientes.addDireccion(id, dto);
  }

  @Patch(':id/direcciones/:dirId')
  updateDireccion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dirId', ParseUUIDPipe) dirId: string,
    @Body() dto: UpdateDireccionDto,
  ) {
    return this.clientes.updateDireccion(id, dirId, dto);
  }

  @Delete(':id/direcciones/:dirId')
  removeDireccion(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('dirId', ParseUUIDPipe) dirId: string,
  ) {
    return this.clientes.removeDireccion(id, dirId);
  }
}
```

- [ ] **Step 2: Verificar que compila y commit**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores.

```bash
git add backend/src/clientes/clientes.controller.ts
git commit -m "feat(backend): ClientesController con CRUD y sub-recursos protegido por AuthGuard"
```

---

### Task 7: ClientesModule + registro en AppModule

**Files:**
- Create: `backend/src/clientes/clientes.module.ts`
- Modify: `backend/src/app.module.ts:40-46`

- [ ] **Step 1: Crear el módulo**

`backend/src/clientes/clientes.module.ts`:
```ts
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

- [ ] **Step 2: Registrar el módulo en AppModule**

En `backend/src/app.module.ts`, reemplazar el bloque de imports comentado (líneas 40-46):
```ts
    // Módulos de la app
    HealthModule,
    // TODO: Agregar módulos a medida que se migran las APIs
    // ClientesModule,
    // ZonasModule,
    // UsuariosModule,
    // FleterasModule,
    // AsignacionesModule,
```
por:
```ts
    // Módulos de la app
    HealthModule,
    ClientesModule,
    // TODO: Agregar módulos a medida que se migran las APIs
    // ZonasModule,
    // UsuariosModule,
    // FleterasModule,
    // AsignacionesModule,
```
Y agregar el import al inicio del archivo, debajo de `import { HealthModule } ...`:
```ts
import { ClientesModule } from './clientes/clientes.module';
```

- [ ] **Step 3: Verificar que arranca y los tests pasan**

Run: `cd backend && npx jest && npx tsc --noEmit -p tsconfig.json`
Expected: todos los specs PASS (auth.guard 4 + clientes.service 9) y compilación sin errores.

- [ ] **Step 4: Commit**

```bash
git add backend/src/clientes/clientes.module.ts backend/src/app.module.ts
git commit -m "feat(backend): registrar ClientesModule en AppModule"
```

---

### Task 8: Migración de esquema

**Files:**
- Create: `backend/src/migrations/<timestamp>-CreateClientes.ts` (generado por la CLI)

En dev, `synchronize: true` ya crea las tablas al arrancar. Esta migración es para producción (donde `synchronize` está apagado). Requiere una base Postgres accesible con las credenciales de `backend/.env`.

- [ ] **Step 1: Asegurar que la base de dev está corriendo**

Run: `cd backend && npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js query "SELECT 1" -d src/config/data-source.ts`
Expected: devuelve `[ { "?column?": 1 } ]`. Si falla por conexión, levantar Postgres (ver `docker-compose.dev.yml` en la raíz) y reintentar.

- [ ] **Step 2: Generar la migración**

Run: `cd backend && pnpm migration:generate src/migrations/CreateClientes`
Expected: crea `src/migrations/<timestamp>-CreateClientes.ts` con `CREATE TABLE "clientes"`, `"cliente_telefonos"`, `"cliente_direcciones"`, los tipos enum y las FKs.

- [ ] **Step 3: Aplicar la migración**

Run: `cd backend && pnpm migration:run`
Expected: "Migration CreateClientes... has been executed successfully".

- [ ] **Step 4: Commit**

```bash
git add backend/src/migrations/
git commit -m "feat(backend): migración de tablas clientes/telefonos/direcciones"
```

---

### Task 9: Smoke manual end-to-end

**Files:** (ninguno — verificación)

- [ ] **Step 1: Levantar el backend**

Run (en una terminal): `cd backend && pnpm start:dev`
Expected: "Nest application successfully started" escuchando en `0.0.0.0:3001`.

- [ ] **Step 2: Verificar que el guard rechaza sin token**

Run: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/clientes`
Expected: `401`.

- [ ] **Step 3: Crear un cliente con token**

Generar un token de prueba (payload con `exp` lejano) y crear:
```bash
TOKEN="eyJhbGciOiJIUzI1NiJ9.$(printf '{"sub":"test","exp":32503680000}' | basenc --base64url -w0).sig"
curl -s -X POST http://localhost:3001/api/clientes \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Juan","apellido":"Pérez","tipoCliente":"DOMESTICO","telefonos":[{"numero":"099123456","esPrincipal":true}]}'
```
Expected: JSON del cliente creado con `id` (uuid), `estado: "ACTIVO"`, `fechaAlta` seteada.
(Si `basenc` no está disponible en el entorno, usar el token del Step 3 de Task 2 — cualquier token con `exp` en el año 3000 sirve.)

- [ ] **Step 4: Listar y leer la ficha**

```bash
curl -s "http://localhost:3001/api/clientes?search=Juan" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:3001/api/clientes/<id-del-paso-3>" -H "Authorization: Bearer $TOKEN"
```
Expected: la lista devuelve `{ data: [...], total: 1, page: 1, pageSize: 20 }`; la ficha devuelve el cliente con su array `telefonos` poblado.

- [ ] **Step 5: Documentar el resultado**

Si todos los pasos respondieron lo esperado, la Fase 1 está completa. El frontend (Fase 2) consumirá `GET/POST/PATCH/DELETE /api/clientes` a través del proxy `/api` existente.

---

## Self-Review (completado)

- **Cobertura del spec:** modelo de datos → Task 1; auth guard → Task 2; DTOs/validación → Task 3; CRUD `GET/POST/PATCH/DELETE /clientes` + sub-recursos → Tasks 4-6; registro del módulo → Task 7; persistencia/migración → Task 8; verificación → Task 9. Endpoints `autocompletar`/`validar-zona` y `pedidos/servicios/cuenta` quedan explícitamente fuera (ver Scope note). Import del padrón = Fase 6 (otro plan).
- **Placeholders:** ninguno; todo el código está completo.
- **Consistencia de tipos:** nombres de métodos (`findAll/findOne/create/update/remove`, `addTelefono/updateTelefono/removeTelefono`, `addDireccion/updateDireccion/removeDireccion`) coinciden entre service (Tasks 4-5), controller (Task 6) y tests. Propiedades de entidad (`fechaAlta`, `fechaUltModif`, `esPrincipal`, `enZona`) consistentes entre entidad, DTOs y service.
