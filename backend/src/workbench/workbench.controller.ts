import {
  Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { WorkbenchService } from './workbench.service';
import { QuerySugerenciasDto } from './dto/query-sugerencias.dto';

interface AuthedRequest {
  user?: { username?: string; [k: string]: unknown };
}

@ApiTags('workbench')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('workbench')
export class WorkbenchController {
  constructor(private readonly workbench: WorkbenchService) {}

  @Get('sugerencias')
  listar(@Query() query: QuerySugerenciasDto) {
    return this.workbench.listar(query);
  }

  @Post('sugerencias/:id/aceptar')
  aceptar(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.workbench.aceptar(id, req.user?.username ?? '');
  }

  @Post('sugerencias/:id/rechazar')
  rechazar(@Param('id', ParseIntPipe) id: number, @Req() req: AuthedRequest) {
    return this.workbench.rechazar(id, req.user?.username ?? '');
  }

  @Post('sugerencias/:id/deshacer')
  deshacer(@Param('id', ParseIntPipe) id: number) {
    return this.workbench.deshacer(id);
  }
}
