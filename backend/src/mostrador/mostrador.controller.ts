import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  HttpCode,
  Injectable,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { CalleSugerida, CallesService } from '../calles/calles.service';
import { EsquinasService, ResultadoEsquinas } from '../calles/esquinas.service';
import {
  BuscarCallesMostradorDto,
  CrearSesionDto,
  EsquinasMostradorDto,
  FichaDto,
  GuardarFichaDto,
  GuardarResultadoDto,
  SesionCreadaDto,
} from './dto/mostrador.dto';
import { MostradorService } from './mostrador.service';
import { SesionMostrador, SesionService } from './sesion.service';

/** El request, con la sesión que le colgó el guard. */
interface PedidoConSesion {
  sesion?: SesionMostrador;
}

/**
 * Puerta del shell (FichaGoya.exe): `x-api-key` contra MOSTRADOR_API_KEY.
 * Mismo patrón que CallesApiKeyGuard pero con su propia key: el mostrador y el
 * VB6 son consumidores distintos y una key comprometida no arrastra a la otra.
 */
@Injectable()
export class MostradorApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // Un header repetido llega como array: no se adivina cuál vale, se descarta.
    const cruda: unknown = req.headers?.['x-api-key'];
    const provista = typeof cruda === 'string' ? cruda : undefined;
    const esperada = process.env.MOSTRADOR_API_KEY;
    if (!esperada) {
      throw new UnauthorizedException('MOSTRADOR_API_KEY no configurada en el backend');
    }
    if (!provista) {
      throw new UnauthorizedException('Falta header x-api-key');
    }
    const a = Buffer.from(provista);
    const b = Buffer.from(esperada);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('x-api-key inválida');
    }
    return true;
  }
}

/**
 * Puerta de la UI: Bearer con el token de sesión. Si la ruta tiene `:cliid`,
 * el token tiene que ser de ESE cliente.
 */
@Injectable()
export class SesionMostradorGuard implements CanActivate {
  constructor(private readonly sesiones: SesionService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const cabecera: unknown = req.headers?.authorization;
    const header = typeof cabecera === 'string' ? cabecera : undefined;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Falta el token de la sesión de mostrador');
    }
    const token = header.slice('Bearer '.length).trim();

    // El :cliid se parsea con el MISMO criterio que el ParseIntPipe del handler
    // (`/^-?\d+$/` + parseInt). Si acá se leyera más suelto —`Number()` acepta
    // "1e3", "0x10", " 7"— el guard validaría un cliente y el handler tocaría
    // otro: el alcance del token quedaría de adorno.
    const paramCliid = req.params?.cliid;
    let cliid: number | undefined;
    if (paramCliid !== undefined) {
      const crudo = String(paramCliid);
      cliid = /^\d+$/.test(crudo) ? Number(crudo) : Number.NaN;
      if (!Number.isSafeInteger(cliid) || cliid <= 0) {
        throw new UnauthorizedException('El cliente de la URL no es válido');
      }
    }

    const sesion = this.sesiones.validar(token, cliid);
    if (!sesion) {
      throw new UnauthorizedException(
        'La sesión venció o no corresponde a este cliente: volvé a abrir la ficha',
      );
    }
    req.sesion = sesion;
    return true;
  }
}

@ApiTags('mostrador')
@Controller('mostrador')
export class MostradorController {
  constructor(
    private readonly mostrador: MostradorService,
    private readonly sesiones: SesionService,
    private readonly calles: CallesService,
    private readonly esquinas: EsquinasService,
  ) {}

  /** El shell pide el token antes de abrir la ventana: la key nunca va al navegador. */
  @Post('sesion')
  @HttpCode(200)
  @UseGuards(MostradorApiKeyGuard)
  crearSesion(@Body() body: CrearSesionDto): SesionCreadaDto {
    const { token, sesion } = this.sesiones.crear(body.cliid, body.operador);
    return {
      token,
      expiraEn: new Date(sesion.expira).toISOString(),
      cliid: sesion.cliid,
      operador: sesion.operador,
    };
  }

  @Get('ficha/:cliid')
  @UseGuards(SesionMostradorGuard)
  ficha(@Param('cliid', ParseIntPipe) cliid: number): Promise<FichaDto> {
    return this.mostrador.ficha(cliid);
  }

  @Post('ficha/:cliid')
  @HttpCode(200)
  @UseGuards(SesionMostradorGuard)
  guardar(
    @Param('cliid', ParseIntPipe) cliid: number,
    @Body() body: GuardarFichaDto,
    @Req() req: PedidoConSesion,
  ): Promise<GuardarResultadoDto> {
    // El operador sale del token, NUNCA del payload: es lo que queda en CLIOPUPD.
    // Sin operador no se escribe: una fila del AS400 sin quién la tocó es peor
    // que no guardar.
    const operador = req.sesion?.operador;
    if (!operador) {
      throw new UnauthorizedException(
        'La sesión no tiene operador: cerrá la ficha y volvé a abrirla desde el mostrador',
      );
    }
    return this.mostrador.guardar(cliid, body.cambios, operador);
  }

  // ── Proxy del puente OSM para la UI ────────────────────────────────────────
  // La UI no puede pegarle a /api/calles/* porque eso pide la CALLES_API_KEY y
  // la key no puede vivir en el navegador. Acá entra con el token de sesión.

  @Get('calles')
  @UseGuards(SesionMostradorGuard)
  buscarCalles(@Query() q: BuscarCallesMostradorDto): CalleSugerida[] {
    return this.calles.buscar(q.q, q.depto, q.ciudad);
  }

  @Get('esquinas')
  @UseGuards(SesionMostradorGuard)
  esquinasDe(@Query() q: EsquinasMostradorDto): Promise<ResultadoEsquinas> {
    return this.esquinas.esquinasDe(q.calle, q.numero, q.depto, q.ciudad);
  }
}
