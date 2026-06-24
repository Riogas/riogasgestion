import { PartialType } from '@nestjs/swagger';
import { TelefonoInputDto } from './telefono-input.dto';

export class UpdateTelefonoDto extends PartialType(TelefonoInputDto) {}
