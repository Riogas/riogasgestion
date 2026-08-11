import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import { AuthGuard, decodeJwtPayload } from '../common/guards/auth.guard';
import { CallesService, CalleSugerida } from './calles.service';
import { EsquinasService, ResultadoEsquinas } from './esquinas.service';
import {
  BuscarCallesDto,
  EsquinasDto,
  ListarMatchesDto,
  ResolverDto,
  RevisarMatchDto,
} from './dto/calles.dto';

/**
 * Puerta para consumidores máquina (el VB6): header `x-api-key` contra
 * CALLES_API_KEY. También deja pasar a un usuario del panel con JWT, así la
 * pantalla de revisión reutiliza el mismo buscador para el picker de
 * "corregir" sin necesitar la key.
 */
@Injectable()
export class CallesApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();

    const auth: string | undefined = req.headers?.authorization;
    if (auth?.startsWith('Bearer ') && decodeJwtPayload(auth.slice(7))) {
      return true;
    }

    const provided: string | undefined = req.headers?.['x-api-key'];
    const expected = process.env.CALLES_API_KEY;
    if (!expected) {
      throw new UnauthorizedException('CALLES_API_KEY no configurada en el backend');
    }
    if (!provided) {
      throw new UnauthorizedException('Falta header x-api-key');
    }
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new UnauthorizedException('x-api-key inválida');
    }
    return true;
  }
}

/** `campo|campo|campo` por línea: un `Split()` en VB6 y listo. */
function comoTexto(filas: (string | number | null)[][]): string {
  return filas
    .map((f) => f.map((v) => (v === null || v === undefined ? '' : String(v))).join('|'))
    .join('\n');
}

@ApiTags('calles')
@Controller('calles')
export class CallesController {
  constructor(
    private readonly calles: CallesService,
    private readonly esquinas: EsquinasService,
  ) {}

  // ── Para el VB6 y cualquier sistema (x-api-key) ──────────────────────────

  @Get('buscar')
  @UseGuards(CallesApiKeyGuard)
  buscar(@Query() q: BuscarCallesDto): CalleSugerida[] | string {
    const resultados = this.calles.buscar(q.q, q.depto, q.ciudad);
    if (q.formato === 'texto') {
      return comoTexto(
        resultados.map((r) => [
          r.calid,
          r.nombre,
          r.localidad,
          r.departamento,
          r.fuente,
          r.matchEstado,
        ]),
      );
    }
    return resultados;
  }

  @Get('esquinas')
  @UseGuards(CallesApiKeyGuard)
  async esquinasDe(@Query() q: EsquinasDto): Promise<ResultadoEsquinas | string> {
    const r = await this.esquinas.esquinasDe(q.calle, q.numero, q.depto, q.ciudad);
    if (q.formato === 'texto') {
      return comoTexto([[
        r.encontrada ? 1 : 0,
        r.precision,
        r.calle,
        r.calid,
        r.esquina1?.nombre ?? null,
        r.esquina1?.calid ?? null,
        r.esquina2?.nombre ?? null,
        r.esquina2?.calid ?? null,
        r.barrio,
        r.localidad,
        r.lat,
        r.lng,
      ]]);
    }
    return r;
  }

  @Get('resolver')
  @UseGuards(CallesApiKeyGuard)
  resolver(@Query() q: ResolverDto): CalleSugerida[] {
    return this.calles.resolver(q.nombreOsm, q.depto, q.localidad);
  }

  @Get('estado')
  @UseGuards(CallesApiKeyGuard)
  estado() {
    return this.calles.estado();
  }

  // ── Para la pantalla de revisión del panel (JWT) ─────────────────────────

  @Get('matches')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  listarMatches(@Query() q: ListarMatchesDto) {
    return this.calles.listarMatches(q.estado, q.take ?? 50, q.skip ?? 0);
  }

  @Get('matches/:id/mapa')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  mapa(@Param('id', ParseIntPipe) id: number) {
    return this.calles.mapaDeMatch(id);
  }

  @Patch('matches/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  revisar(@Param('id', ParseIntPipe) id: number, @Body() body: RevisarMatchDto) {
    return this.calles.revisarMatch(id, body.accion, body.usuario, body.calleOsmId);
  }

  @Post('recargar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  recargar() {
    return this.calles.recargar();
  }
}
