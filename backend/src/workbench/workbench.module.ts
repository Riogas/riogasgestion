import { Module } from '@nestjs/common';
import { PersonasModule } from '../personas/personas.module';
import { WorkbenchService } from './workbench.service';

@Module({
  imports: [PersonasModule],
  providers: [WorkbenchService],
  exports: [WorkbenchService],
})
export class WorkbenchModule {}
