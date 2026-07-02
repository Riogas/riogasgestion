import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export const TIPOS_ZONA = ['DISTRIBUCION', 'FLETE'] as const;
export const SERVICIOS_ZONA = ['URGENTE', 'SERVICE', 'NOCTURNO'] as const;
export const ESTADOS_ZONA = ['ACTIVE', 'ARCHIVED'] as const;

export class PuntoPoligonoDto {
  @Type(() => Number) @IsNumber()
  lat!: number;

  @Type(() => Number) @IsNumber()
  lng!: number;
}

export class CreateZonaDto {
  @Type(() => Number) @IsInt()
  puestoId!: number;

  @IsString() @Length(1, 60)
  nombre!: string;

  @IsOptional() @IsString() @MaxLength(200)
  descripcion?: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color debe ser #RRGGBB' })
  color!: string;

  @IsIn(TIPOS_ZONA)
  tipoZona!: string;

  @IsArray() @IsIn(SERVICIOS_ZONA, { each: true })
  servicios!: string[];

  @IsOptional() @IsIn(ESTADOS_ZONA)
  estado?: string;

  @IsArray()
  @ArrayMinSize(3, { message: 'el polígono necesita al menos 3 puntos' })
  @ValidateNested({ each: true })
  @Type(() => PuntoPoligonoDto)
  poligono!: PuntoPoligonoDto[];
}
