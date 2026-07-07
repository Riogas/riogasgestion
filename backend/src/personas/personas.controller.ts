import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../common/guards/auth.guard';
import { PersonasService } from './personas.service';
import { SetCanonicalDto } from './dto/set-canonical.dto';
import { RegistroIdsDto } from './dto/registro-ids.dto';

interface AuthedRequest {
  user?: { username?: string; [k: string]: unknown };
}

@ApiTags('personas')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('personas')
export class PersonasController {
  constructor(private readonly personas: PersonasService) {}

  @Get(':id')
  find360(@Param('id', ParseIntPipe) id: number) {
    return this.personas.find360(id);
  }

  @Patch(':id/canonical')
  setCanonical(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetCanonicalDto,
  ) {
    return this.personas.setCanonical(id, dto);
  }

  @Post('unify')
  unify(@Body() dto: RegistroIdsDto, @Req() req: AuthedRequest) {
    return this.personas.unify(dto.registroIds, req.user?.username);
  }

  @Post('split')
  split(@Body() dto: RegistroIdsDto) {
    return this.personas.split(dto.registroIds);
  }
}
