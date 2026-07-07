import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsInt,
} from 'class-validator';

export class RegistroIdsDto {
  @IsArray() @ArrayMinSize(1) @Type(() => Number) @IsInt({ each: true })
  registroIds: number[];
}
