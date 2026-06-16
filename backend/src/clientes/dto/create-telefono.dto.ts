import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTelefonoDto {
  @IsString()
  @MaxLength(40)
  numero: string;

  @IsOptional() @IsString() @MaxLength(60)
  alias?: string;

  @IsOptional() @IsString() @MaxLength(40)
  tipo?: string;

  @IsOptional() @IsString() @MaxLength(20)
  estado?: string;

  @IsOptional() @IsBoolean()
  esPrincipal?: boolean;
}
