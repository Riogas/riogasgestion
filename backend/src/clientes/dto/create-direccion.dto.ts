import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDireccionDto {
  @IsString() @MaxLength(160)
  calle: string;

  @IsOptional() @IsString() @MaxLength(20)
  nroPuerta?: string;

  @IsOptional() @IsString() @MaxLength(160)
  esquina1?: string;

  @IsOptional() @IsString() @MaxLength(160)
  esquina2?: string;

  @IsOptional() @IsString() @MaxLength(40)
  apto?: string;

  @IsOptional() @IsString() @MaxLength(60)
  local?: string;

  @IsOptional() @IsInt()
  departamentoId?: number;

  @IsOptional() @IsInt()
  localidadId?: number;

  @IsOptional() @IsString() @MaxLength(80)
  zona?: string;

  @IsOptional() @IsNumber()
  lat?: number;

  @IsOptional() @IsNumber()
  lng?: number;

  @IsOptional() @IsString() @MaxLength(40)
  nivel?: string;

  @IsOptional() @IsBoolean()
  esPrincipal?: boolean;

  @IsOptional() @IsBoolean()
  enZona?: boolean;
}
