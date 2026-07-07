import { IsIn, IsString } from 'class-validator';

export class IdentificarBodyDto {
  @IsString()
  identificador: string;

  @IsIn(['CEDULA', 'TELEFONO'])
  tipo: 'CEDULA' | 'TELEFONO';
}
