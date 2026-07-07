import {
  Body, Controller, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { IdentificacionService } from './identificacion.service';
import { IdentificarBodyDto } from './dto/identificar.dto';

interface AuthedRequest {
  user?: {
    username?: string;
    rol?: 'CALL_CENTER' | 'DISTRIBUIDOR';
    empresaFleteraId?: number;
    [k: string]: unknown;
  };
}

@ApiTags('identificacion')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('identificacion')
export class IdentificacionController {
  constructor(private readonly identificacion: IdentificacionService) {}

  @Post()
  identificar(@Body() dto: IdentificarBodyDto, @Req() req: AuthedRequest) {
    // req.user es el payload crudo del JWT: un rol ausente/desconocido NUNCA
    // debe caer en el rol privilegiado (CALL_CENTER). Fail-closed a DISTRIBUIDOR.
    const rol = req.user?.rol === 'CALL_CENTER' ? 'CALL_CENTER' : 'DISTRIBUIDOR';
    const empresaFleteraId = req.user?.empresaFleteraId != null
      ? Number(req.user.empresaFleteraId)
      : undefined;

    return this.identificacion.identificar({
      identificador: dto.identificador,
      tipo: dto.tipo,
      rol,
      empresaFleteraId,
    });
  }
}
