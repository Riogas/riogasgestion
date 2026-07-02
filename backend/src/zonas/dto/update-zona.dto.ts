import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ESTADOS_ZONA,
  PuntoPoligonoDto,
  SERVICIOS_ZONA,
  TIPOS_ZONA,
} from './create-zona.dto';

// Todos los campos opcionales (PATCH). puestoId no se cambia: una zona no
// se muda de puesto (se elimina y se crea en el otro).
export class UpdateZonaDto {
  @IsOptional() @IsString() @Length(1, 60)
  nombre?: string;

  @IsOptional() @IsString() @MaxLength(200)
  descripcion?: string;

  @IsOptional() @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color debe ser #RRGGBB' })
  color?: string;

  @IsOptional() @IsIn(TIPOS_ZONA)
  tipoZona?: string;

  @IsOptional() @IsArray() @IsIn(SERVICIOS_ZONA, { each: true })
  servicios?: string[];

  @IsOptional() @IsIn(ESTADOS_ZONA)
  estado?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(3, { message: 'el polígono necesita al menos 3 puntos' })
  @ValidateNested({ each: true })
  @Type(() => PuntoPoligonoDto)
  poligono?: PuntoPoligonoDto[];
}
