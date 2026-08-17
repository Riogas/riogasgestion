import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import archiver from 'archiver';
import type { Request, Response } from 'express';
import * as QRCode from 'qrcode';
import { AuthGuard } from '../common/guards/auth.guard';
import { CreateSorteoDto } from './dto/create-sorteo.dto';
import { CrearLoteDto } from './dto/crear-lote.dto';
import { QueryParticipacionesDto } from './dto/query-participaciones.dto';
import { QuerySorteosDto } from './dto/query-sorteos.dto';
import { UpdateSorteoDto } from './dto/update-sorteo.dto';
import { SorteosService } from './sorteos.service';

/** Códigos por vuelta al armar el ZIP: un lote de 10.000 no entra en memoria. */
const CODIGOS_POR_BATCH = 200;

const QR_OPTIONS: QRCode.QRCodeToBufferOptions = {
  width: 1024,
  margin: 4,
  errorCorrectionLevel: 'M',
};

/**
 * Cada código es un PNG de 1024px encodeado en el hilo principal (~decenas de ms):
 * un lote de 10.000 son minutos de CPU. Sin tope, dos descargas en paralelo dejan
 * sin event loop al resto del backend (clientes, móviles, zonas), así que la
 * segunda se rechaza con 429 en vez de encolarse.
 */
const ZIP_MAX_CONCURRENTES = 1;
let zipsEnCurso = 0;

/** Devuelve el turno al event loop entre batches para que otras requests avancen. */
function cederEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Resuelve cuando la response se cierra (el cliente cortó, o terminó la descarga).
 * Se usa para no quedar colgado esperando algo que ya no puede pasar: con archiver@7
 * `finalize()` NO resuelve si el destino ya fue destruido.
 */
function alCerrarse(res: Response): Promise<void> {
  if (res.destroyed) return Promise.resolve();

  return new Promise<void>((resolve) => {
    res.once('close', resolve);
    res.once('error', () => resolve());
  });
}

/**
 * Espera a que la response drene. Si el cliente corta la descarga no llega
 * ningún `drain` más, así que se escuchan también `close`/`error`: sin eso la
 * promesa queda colgada y el handler nunca libera la conexión.
 */
function esperarDrain(res: Response): Promise<void> {
  if (!res.writableNeedDrain || res.destroyed || res.writableEnded) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const limpiar = () => {
      res.off('drain', alDrenar);
      res.off('close', alCerrar);
      res.off('error', alFallar);
    };
    const alDrenar = () => {
      limpiar();
      resolve();
    };
    const alCerrar = () => {
      limpiar();
      reject(new Error('el cliente cortó la descarga'));
    };
    const alFallar = (err: Error) => {
      limpiar();
      reject(err);
    };
    res.once('drain', alDrenar);
    res.once('close', alCerrar);
    res.once('error', alFallar);
  });
}

@ApiTags('sorteos')
@Controller('sorteos')
export class SorteosAdminController {
  private readonly logger = new Logger(SorteosAdminController.name);

  constructor(private readonly sorteos: SorteosService) {}

  /** Identidad del JWT que valida AuthGuard, recortada al VarChar(80) de la tabla. */
  private usuario(req: Request): string | null {
    const user = (req as Request & { user?: { sub?: unknown; username?: unknown } }).user;
    const identidad = user?.sub ?? user?.username ?? null;
    return identidad ? String(identidad).slice(0, 80) : null;
  }

  // ─── Sorteos ────────────────────────────────────────────────────────────────

  /** Listado paginado de sorteos, con filtros. */
  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  listar(@Query() query: QuerySorteosDto) {
    return this.sorteos.listar(query);
  }

  /** Alta de sorteo. */
  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  crear(@Body() dto: CreateSorteoDto) {
    return this.sorteos.crear(dto);
  }

  /** Detalle de un sorteo con sus lotes de códigos. */
  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.detalle(id);
  }

  /** Modificación parcial de un sorteo. */
  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSorteoDto) {
    return this.sorteos.actualizar(id, dto);
  }

  /** Pone el sorteo en curso: empieza a aceptar participaciones. */
  @Post(':id/activar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  activar(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.activar(id);
  }

  /** Cierra el sorteo: deja de aceptar participaciones. */
  @Post(':id/finalizar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  finalizar(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.finalizar(id);
  }

  /** Cancela el sorteo. */
  @Post(':id/cancelar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.cancelar(id);
  }

  // ─── Lotes de códigos ───────────────────────────────────────────────────────

  /** Genera un lote de códigos de participación para el sorteo. */
  @Post(':id/lotes')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  crearLote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearLoteDto,
    @Req() req: Request,
  ) {
    return this.sorteos.crearLote(id, dto.cantidad, this.usuario(req));
  }

  /** Lotes de códigos generados para el sorteo. */
  @Get(':id/lotes')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  listarLotes(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.listarLotes(id);
  }

  /** Descarga en streaming un ZIP con los PNG de los QR del lote. */
  @Get(':id/lotes/:loteId/zip')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async zipDelLote(
    @Param('id', ParseIntPipe) id: number,
    @Param('loteId', ParseIntPipe) loteId: number,
    @Res() res: Response,
  ) {
    await this.sorteos.buscarLote(id, loteId);

    // Sin base explícita no se genera nada: un default silencioso son miles de
    // stickers impresos apuntando a localhost.
    const base = process.env.SORTEOS_PUBLIC_BASE_URL;
    if (!base) {
      throw new InternalServerErrorException(
        'SORTEOS_PUBLIC_BASE_URL no configurada: los QR apuntarían a una URL inválida',
      );
    }

    if (zipsEnCurso >= ZIP_MAX_CONCURRENTES) {
      throw new HttpException(
        'Ya hay una descarga de códigos generándose; esperá a que termine y volvé a intentar',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    zipsEnCurso += 1;

    // El semáforo se libera una sola vez y por varios caminos: si el cliente aborta
    // la descarga, `finalize()` de archiver@7 nunca resuelve y el `finally` de abajo
    // no llegaría nunca → el backend quedaría en 429 permanente hasta reiniciarlo.
    let liberado = false;
    const liberar = () => {
      if (liberado) return;
      liberado = true;
      zipsEnCurso -= 1;
    };
    res.once('close', liberar);
    res.once('error', liberar);

    // Los PNG ya vienen comprimidos: deflatearlos otra vez es CPU regalada.
    const zip = archiver('zip', { store: true });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="sorteo-${id}-lote-${loteId}.zip"`);
    zip.on('error', (err) => {
      this.logger.error(`ZIP del lote ${loteId}: ${err.message}`);
      res.destroy(err);
    });
    zip.pipe(res);

    try {
      let ultimoId = 0;
      for (;;) {
        const codigos = await this.sorteos.codigosDelLote(loteId, ultimoId, CODIGOS_POR_BATCH);
        if (codigos.length === 0) break;

        for (const c of codigos) {
          const png = await QRCode.toBuffer(`${base}/sorteo/${c.codigo}`, QR_OPTIONS);
          zip.append(png, { name: `${c.codigo}.png` });
        }
        ultimoId = codigos[codigos.length - 1].id;

        // Si el cliente no da abasto, esperar antes de encolar el batch siguiente:
        // los buffers encolados en el archiver son los que consumen la memoria.
        await esperarDrain(res);
        await cederEventLoop();
      }
      // Si la response ya se murió, `finalize()` no resuelve nunca: gana el cierre.
      await Promise.race([zip.finalize(), alCerrarse(res)]);
    } catch (err) {
      this.logger.error(`ZIP del lote ${loteId} abortado: ${(err as Error).message}`);
      zip.abort();
      if (!res.destroyed) res.destroy(err as Error);
    } finally {
      liberar();
    }
  }

  // ─── Participaciones ────────────────────────────────────────────────────────

  /** Listado paginado de participaciones del sorteo. */
  @Get(':id/participaciones')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  listarParticipaciones(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryParticipacionesDto,
  ) {
    return this.sorteos.listarParticipaciones(id, query);
  }

  /** Exporta en streaming las participaciones del sorteo a CSV. */
  @Get(':id/participaciones/export')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async exportarParticipaciones(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    // Los headers se escriben con el primer chunk: si el sorteo no existe, el
    // service tira 404 antes de escribir nada y Nest todavía puede responder JSON.
    let iniciado = false;

    try {
      await this.sorteos.exportarParticipacionesCsv(id, async (chunk) => {
        if (!iniciado) {
          iniciado = true;
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="sorteo-${id}-participaciones.csv"`,
          );
        }
        if (!res.write(chunk)) await esperarDrain(res);
      });

      res.end();
    } catch (err) {
      // Con los headers ya en el aire no se puede responder un JSON de error: el
      // filtro global haría status().json() sobre una response ya empezada
      // (ERR_HTTP_HEADERS_SENT → unhandled rejection → proceso muerto en Node 22).
      // Se corta la conexión para que el cliente vea la descarga incompleta.
      if (!iniciado && !res.headersSent) throw err;

      this.logger.error(
        `Export CSV del sorteo ${id} abortado: ${(err as Error).message}`,
      );
      if (!res.destroyed) res.destroy(err as Error);
    }
  }

  /** Marca la participación ganadora como premio entregado. */
  @Post('participaciones/:id/entregar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  marcarPremioEntregado(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.marcarPremioEntregado(id);
  }
}
