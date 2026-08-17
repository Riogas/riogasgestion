import {
  Body,
  CanActivate,
  Controller,
  Delete,
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
import { AuthGuard } from '../common/guards/auth.guard';
import { ZonasService } from './zonas.service';
import { CreateZonaDto } from './dto/create-zona.dto';
import { UpdateZonaDto } from './dto/update-zona.dto';
import { QueryZonasDto } from './dto/query-zonas.dto';
import { TrackZona } from './track-sync.service';

/**
 * Guard del webhook de sincro: header `x-api-key` contra ZONAS_SYNC_API_KEY.
 * Es la puerta de entrada para que TrackMovil empuje cambios de zonas.
 */
@Injectable()
export class SyncApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provided: string | undefined = req.headers?.['x-api-key'];
    const expected = process.env.ZONAS_SYNC_API_KEY;
    if (!expected) {
      throw new UnauthorizedException('ZONAS_SYNC_API_KEY no configurada');
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

@ApiTags('zonas')
@Controller('zonas')
export class ZonasController {
  constructor(private readonly zonas: ZonasService) {}

  // ── CRUD (usuarios goya, JWT) ────────────────────────────────────────────

  /** Listado de zonas operativas, con filtros. */
  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  findAll(@Query() query: QueryZonasDto) {
    return this.zonas.findAll(query);
  }

  /** Puestos con zonas, para el selector de la pantalla de zonificación. */
  @Get('puestos')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  puestos() {
    return this.zonas.puestos();
  }

  /** Alta de zona operativa con su polígono. */
  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateZonaDto) {
    return this.zonas.create(dto);
  }

  /** Modificación parcial de una zona (el puesto no se cambia). */
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateZonaDto) {
    return this.zonas.update(id, dto);
  }

  /** Elimina una zona operativa. */
  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.zonas.remove(id);
  }

  /** Duplica una zona con su polígono. */
  @Post(':id/duplicar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  duplicar(@Param('id', ParseIntPipe) id: number) {
    return this.zonas.duplicar(id);
  }

  // ── Sincro con TrackMovil ────────────────────────────────────────────────

  /** Importa/actualiza desde track (carga inicial y re-sync manual). */
  @Post('sync/pull')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  syncPull() {
    return this.zonas.syncPull();
  }

  /** Reintenta el espejo de las zonas PENDING/ERROR. */
  @Post('sync/push')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  syncPush() {
    return this.zonas.syncPush();
  }

  /** Entrada para track: upsert de zonas con shape de track (x-api-key). */
  @Post('sync/webhook')
  @UseGuards(SyncApiKeyGuard)
  syncWebhook(@Body() body: { zonas?: TrackZona[] } | TrackZona) {
    return this.zonas.syncWebhook(body);
  }
}
