import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Fila de "Recarga y productos" → movil_stock.
 * stockMin=stockMovil, stockDps=stockOcupado (nombres de pantalla vs columna).
 */
export class ProductoInputDto {
  @IsOptional() @IsString() @MaxLength(4)
  productoEmpresa?: string;

  @IsOptional() @IsString() @MaxLength(15)
  productoCodigo?: string;

  @IsOptional() @Type(() => Number) @IsInt()
  stockMin?: number; // → stockMovil

  @IsOptional() @Type(() => Number) @IsInt()
  stockDps?: number; // → stockOcupado

  @IsOptional() @Type(() => Number) @IsInt()
  tiempoCarga?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  tiempoDescarga?: number;
}
