import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryParticipacionesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  pageSize?: number;

  // Búsqueda libre por nombre / teléfono / email / código de canje
  @IsOptional() @IsString()
  search?: string;

  // Se lee de `obj` y no de `value`: el enableImplicitConversion global ya
  // convirtió el string a boolean (y 'false' → true) antes de llegar acá.
  @IsOptional()
  @Transform(({ obj, key }) => obj[key] === true || obj[key] === 'true' || obj[key] === '1')
  @IsBoolean()
  soloGanadores?: boolean;
}
