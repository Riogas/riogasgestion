import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateClienteDto } from './create-cliente.dto';

// Update parcial: todos los campos opcionales, sin permitir cambiar el id (PK = CLIID).
export class UpdateClienteDto extends PartialType(
  OmitType(CreateClienteDto, ['id'] as const),
) {}
