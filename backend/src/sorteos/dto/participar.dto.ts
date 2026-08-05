import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CODIGO_REGEX } from '../sorteos.util';

export class ParticiparDto {
  @IsString() @Matches(CODIGO_REGEX)
  codigo!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @Length(3, 120)
  nombre!: string;

  // /\d/ garantiza que haya al menos un dígito; el segundo @Matches cuenta
  // los dígitos del string completo (ignorando separadores) y exige 8-15.
  @IsString()
  @Matches(/\d/, { message: 'telefono debe contener dígitos' })
  @Matches(/^\D*(\d\D*){8,15}$/, { message: 'telefono debe tener entre 8 y 15 dígitos' })
  telefono!: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(120)
  edad!: number;

  @IsOptional() @IsEmail()
  email?: string;

  @IsString() @Length(8, 40)
  deviceId!: string;

  @IsOptional() @IsString() @MaxLength(64)
  fingerprint?: string;

  @IsOptional() @IsString() @MaxLength(10)
  idioma?: string;

  @IsOptional() @IsString() @MaxLength(60)
  plataforma?: string;

  @IsOptional() @IsString() @MaxLength(20)
  resolucion?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90)
  gpsLat?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180)
  gpsLng?: number;
}
