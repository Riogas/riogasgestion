import { PartialType } from '@nestjs/swagger';
import { DireccionInputDto } from './direccion-input.dto';

export class UpdateDireccionDto extends PartialType(DireccionInputDto) {}
