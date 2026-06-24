import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateClienteDto } from './create-cliente.dto';

// Update parcial de la cabecera del cliente; los arrays se editan por sub-recurso.
export class UpdateClienteDto extends PartialType(
  OmitType(CreateClienteDto, ['direcciones', 'telefonos'] as const),
) {}
