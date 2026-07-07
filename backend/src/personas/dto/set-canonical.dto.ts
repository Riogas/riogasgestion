import { Type } from 'class-transformer';
import {
  IsInt, IsOptional, IsString, MaxLength,
} from 'class-validator';

export class SetCanonicalDto {
  @IsOptional() @IsString() @MaxLength(200)
  nombreOficial?: string;

  @IsOptional() @IsString() @MaxLength(12)
  cedula?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  telefonoPrincipalId?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  direccionPrincipalId?: number;
}
