import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Teléfono anidado en el alta de cliente (ClienteTelefono).
 */
export class TelefonoInputDto {
  @IsString() @MaxLength(20)
  numero: string;

  @IsOptional() @IsString() @MaxLength(2)
  tipo?: string;

  @IsOptional() @IsString() @MaxLength(1)
  estado?: string;

  @IsOptional() @IsString() @MaxLength(60)
  alias?: string;

  @IsBoolean()
  principal: boolean;
}
