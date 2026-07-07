import { Module } from '@nestjs/common';
import { PersonasService } from './personas.service';
import { HogarService } from './hogar.service';

@Module({
  providers: [PersonasService, HogarService],
  exports: [PersonasService, HogarService],
})
export class PersonasModule {}
