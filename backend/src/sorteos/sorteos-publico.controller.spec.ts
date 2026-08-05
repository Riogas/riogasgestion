import { ArgumentMetadata, BadRequestException, ExecutionContext, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import { ParticiparDto } from './dto/participar.dto';
import { SorteosApiKeyGuard, SorteosPublicoController } from './sorteos-publico.controller';
import { SorteosService } from './sorteos.service';

const CODIGO_VALIDO = 'ABCDEFGHJKMN';

function crearServiceMock() {
  return {
    estadoPublico: jest.fn().mockResolvedValue({ estado: 'ok' }),
    participar: jest.fn().mockResolvedValue({ resultado: 'sigue' }),
  };
}

function requestCon(overrides: Partial<Request> = {}): Request {
  return { headers: {}, ip: '203.0.113.9', ...overrides } as unknown as Request;
}

function participarDto(): ParticiparDto {
  return {
    codigo: CODIGO_VALIDO,
    nombre: 'Juan Pérez',
    telefono: '099123456',
    edad: 30,
    deviceId: 'device-1234',
  } as ParticiparDto;
}

describe('SorteosPublicoController', () => {
  let service: ReturnType<typeof crearServiceMock>;
  let controller: SorteosPublicoController;

  beforeEach(() => {
    service = crearServiceMock();
    controller = new SorteosPublicoController(service as unknown as SorteosService);
  });

  describe('estado', () => {
    it('codigo inválido (regex) no toca el service', async () => {
      const r = await controller.estado('minusculas-invalidas');

      expect(r).toEqual({ estado: 'invalido' });
      expect(service.estadoPublico).not.toHaveBeenCalled();
    });

    it('sin codigo no toca el service', async () => {
      const r = await controller.estado(undefined);

      expect(r).toEqual({ estado: 'invalido' });
      expect(service.estadoPublico).not.toHaveBeenCalled();
    });

    it('codigo válido delega en el service', async () => {
      await controller.estado(CODIGO_VALIDO);

      expect(service.estadoPublico).toHaveBeenCalledWith(CODIGO_VALIDO);
    });
  });

  describe('participar', () => {
    it('toma la primera ip de x-forwarded-for (split coma)', async () => {
      const req = requestCon({
        headers: { 'x-forwarded-for': '198.51.100.5, 10.0.0.1', 'user-agent': 'TestAgent/1.0' },
      } as unknown as Partial<Request>);

      await controller.participar(participarDto(), req);

      expect(service.participar).toHaveBeenCalledWith(
        expect.objectContaining({ ip: '198.51.100.5', userAgent: 'TestAgent/1.0' }),
      );
    });

    it('sin x-forwarded-for cae en req.ip', async () => {
      const req = requestCon();

      await controller.participar(participarDto(), req);

      expect(service.participar).toHaveBeenCalledWith(expect.objectContaining({ ip: '203.0.113.9' }));
    });

    it('trunca el user-agent a 500 chars', async () => {
      const largo = 'a'.repeat(600);
      const req = requestCon({ headers: { 'user-agent': largo } } as unknown as Partial<Request>);

      await controller.participar(participarDto(), req);

      const llamado = service.participar.mock.calls[0][0];
      expect(llamado.userAgent).toHaveLength(500);
    });

    it('pasa el resto de los campos del dto tal cual', async () => {
      const req = requestCon();
      const dto = participarDto();

      await controller.participar(dto, req);

      expect(service.participar).toHaveBeenCalledWith(
        expect.objectContaining({
          codigo: dto.codigo,
          nombre: dto.nombre,
          telefono: dto.telefono,
          edad: dto.edad,
          deviceId: dto.deviceId,
        }),
      );
    });
  });
});

describe('SorteosApiKeyGuard', () => {
  const envOriginal = process.env.SORTEOS_PUBLIC_API_KEY;
  let guard: SorteosApiKeyGuard;

  beforeEach(() => {
    guard = new SorteosApiKeyGuard();
  });

  afterEach(() => {
    if (envOriginal === undefined) delete process.env.SORTEOS_PUBLIC_API_KEY;
    else process.env.SORTEOS_PUBLIC_API_KEY = envOriginal;
  });

  function contextCon(headers: Record<string, string | undefined>): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ headers }) }),
    } as unknown as ExecutionContext;
  }

  it('sin SORTEOS_PUBLIC_API_KEY configurada → 401', () => {
    delete process.env.SORTEOS_PUBLIC_API_KEY;

    expect(() => guard.canActivate(contextCon({ 'x-api-key': 'cualquiera' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('sin header x-api-key → 401', () => {
    process.env.SORTEOS_PUBLIC_API_KEY = 'secreta';

    expect(() => guard.canActivate(contextCon({}))).toThrow(UnauthorizedException);
  });

  it('key incorrecta → 401', () => {
    process.env.SORTEOS_PUBLIC_API_KEY = 'secreta';

    expect(() => guard.canActivate(contextCon({ 'x-api-key': 'incorrecta' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('key correcta → pasa', () => {
    process.env.SORTEOS_PUBLIC_API_KEY = 'secreta';

    expect(guard.canActivate(contextCon({ 'x-api-key': 'secreta' }))).toBe(true);
  });
});

describe('ParticiparDto (ValidationPipe real)', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const metadata: ArgumentMetadata = { type: 'body', metatype: ParticiparDto, data: '' };

  it('acepta un payload válido', async () => {
    const r = await pipe.transform(
      {
        codigo: CODIGO_VALIDO,
        nombre: 'Juan Pérez',
        telefono: '099123456',
        edad: 30,
        deviceId: 'device-1234',
      },
      metadata,
    );

    expect(r).toBeInstanceOf(ParticiparDto);
    expect(r.edad).toBe(30);
  });

  it('rechaza teléfono corto (menos de 8 dígitos)', async () => {
    await expect(
      pipe.transform(
        {
          codigo: CODIGO_VALIDO,
          nombre: 'Juan Pérez',
          telefono: '12345',
          edad: 30,
          deviceId: 'device-1234',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza edad fuera de rango', async () => {
    await expect(
      pipe.transform(
        {
          codigo: CODIGO_VALIDO,
          nombre: 'Juan Pérez',
          telefono: '099123456',
          edad: 150,
          deviceId: 'device-1234',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza codigo que no matchea CODIGO_REGEX', async () => {
    await expect(
      pipe.transform(
        {
          codigo: 'minusculas',
          nombre: 'Juan Pérez',
          telefono: '099123456',
          edad: 30,
          deviceId: 'device-1234',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza un email más largo que la columna (VarChar(120))', async () => {
    const largo = `${'a'.repeat(115)}@ejemplo.com`;

    await expect(
      pipe.transform(
        {
          codigo: CODIGO_VALIDO,
          nombre: 'Juan Pérez',
          telefono: '099123456',
          edad: 30,
          email: largo,
          deviceId: 'device-1234',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('acepta un email dentro del largo de la columna', async () => {
    const r = await pipe.transform(
      {
        codigo: CODIGO_VALIDO,
        nombre: 'Juan Pérez',
        telefono: '099123456',
        edad: 30,
        email: 'juan.perez@ejemplo.com',
        deviceId: 'device-1234',
      },
      metadata,
    );

    expect(r.email).toBe('juan.perez@ejemplo.com');
  });

  it('rechaza un teléfono con relleno absurdo de separadores', async () => {
    await expect(
      pipe.transform(
        {
          codigo: CODIGO_VALIDO,
          nombre: 'Juan Pérez',
          telefono: `099123456${'-'.repeat(50)}`,
          edad: 30,
          deviceId: 'device-1234',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza campos extra (ip/userAgent no son parte del dto)', async () => {
    await expect(
      pipe.transform(
        {
          codigo: CODIGO_VALIDO,
          nombre: 'Juan Pérez',
          telefono: '099123456',
          edad: 30,
          deviceId: 'device-1234',
          ip: '1.2.3.4',
        },
        metadata,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
