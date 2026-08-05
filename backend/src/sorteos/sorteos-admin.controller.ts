import {
  Body,
  Controller,
  Get,
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
import { once } from 'events';
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

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  listar(@Query() query: QuerySorteosDto) {
    return this.sorteos.listar(query);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  crear(@Body() dto: CreateSorteoDto) {
    return this.sorteos.crear(dto);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.detalle(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSorteoDto) {
    return this.sorteos.actualizar(id, dto);
  }

  @Post(':id/activar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  activar(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.activar(id);
  }

  @Post(':id/finalizar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  finalizar(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.finalizar(id);
  }

  @Post(':id/cancelar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.cancelar(id);
  }

  // ─── Lotes de códigos ───────────────────────────────────────────────────────

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

  @Get(':id/lotes')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  listarLotes(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.listarLotes(id);
  }

  @Get(':id/lotes/:loteId/zip')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async zipDelLote(
    @Param('id', ParseIntPipe) id: number,
    @Param('loteId', ParseIntPipe) loteId: number,
    @Res() res: Response,
  ) {
    await this.sorteos.buscarLote(id, loteId);

    const base = process.env.SORTEOS_PUBLIC_BASE_URL || 'http://localhost:3000';
    // archiver 8 es ESM puro: import diferido para que el resto del controller
    // siga siendo importable desde CommonJS (tests). Los PNG ya vienen
    // comprimidos, así que se guardan sin deflatear de nuevo.
    const { ZipArchive } = await import('archiver');
    const zip = new ZipArchive({ store: true });

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
        if (res.writableNeedDrain) await once(res, 'drain');
      }
      await zip.finalize();
    } catch (err) {
      this.logger.error(`ZIP del lote ${loteId} abortado: ${(err as Error).message}`);
      zip.abort();
      res.destroy(err as Error);
    }
  }

  // ─── Participaciones ────────────────────────────────────────────────────────

  @Get(':id/participaciones')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  listarParticipaciones(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: QueryParticipacionesDto,
  ) {
    return this.sorteos.listarParticipaciones(id, query);
  }

  @Get(':id/participaciones/export')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  async exportarParticipaciones(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const csv = await this.sorteos.exportarParticipacionesCsv(id);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sorteo-${id}-participaciones.csv"`,
    );
    res.send(csv);
  }

  @Post('participaciones/:id/entregar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  marcarPremioEntregado(@Param('id', ParseIntPipe) id: number) {
    return this.sorteos.marcarPremioEntregado(id);
  }
}
