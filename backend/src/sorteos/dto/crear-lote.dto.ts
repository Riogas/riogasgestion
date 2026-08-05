import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class CrearLoteDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000)
  cantidad!: number;
}
