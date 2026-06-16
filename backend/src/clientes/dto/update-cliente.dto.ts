import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateClienteDto } from './create-cliente.dto';

// Update parcial de campos escalares. Teléfonos y direcciones se manejan
// por sus sub-recursos (no se reemplazan con el PATCH del cliente).
export class UpdateClienteDto extends PartialType(
  OmitType(CreateClienteDto, ['telefonos', 'direcciones'] as const),
) {}
