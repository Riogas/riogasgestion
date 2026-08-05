import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Injectable,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import * as crypto from 'crypto';
import type { Request } from 'express';
import { ParticiparDto } from './dto/participar.dto';
import { SorteosService } from './sorteos.service';
import { CODIGO_REGEX } from './sorteos.util';

/**
 * Guard del formulario público: header `x-api-key` contra SORTEOS_PUBLIC_API_KEY.
 * Mismo patrón que SyncApiKeyGuard (`zonas.controller.ts:31-49`).
 */
@Injectable()
export class SorteosApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const provided: string | undefined = req.headers?.['x-api-key'];
    const expected = process.env.SORTEOS_PUBLIC_API_KEY;
    if (!expected) {
      throw new UnauthorizedException('SORTEOS_PUBLIC_API_KEY no configurada');
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

/** El user-agent lo manda el navegador sin límite; se recorta antes de guardarlo. */
const USER_AGENT_MAX = 500;

@ApiTags('sorteos-publico')
@Controller('sorteos/publico')
@UseGuards(SorteosApiKeyGuard, ThrottlerGuard)
export class SorteosPublicoController {
  constructor(private readonly sorteos: SorteosService) {}

  private ip(req: Request): string | undefined {
    const forwarded = req.headers['x-forwarded-for'];
    const primero = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return primero?.split(',')[0]?.trim() || req.ip;
  }

  private userAgent(req: Request): string | undefined {
    const raw = req.headers['user-agent'];
    return raw ? raw.slice(0, USER_AGENT_MAX) : undefined;
  }

  @Get('estado')
  estado(@Query('codigo') codigo?: string) {
    if (!codigo || !CODIGO_REGEX.test(codigo)) return { estado: 'invalido' as const };
    return this.sorteos.estadoPublico(codigo);
  }

  @Post('participar')
  participar(@Body() dto: ParticiparDto, @Req() req: Request) {
    return this.sorteos.participar({
      ...dto,
      ip: this.ip(req),
      userAgent: this.userAgent(req),
    });
  }
}
