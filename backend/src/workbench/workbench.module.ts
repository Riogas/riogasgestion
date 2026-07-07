import { Module } from '@nestjs/common';
import { PersonasModule } from '../personas/personas.module';
import { WorkbenchService } from './workbench.service';
import { WorkbenchController } from './workbench.controller';

@Module({
  imports: [PersonasModule],
  controllers: [WorkbenchController],
  providers: [WorkbenchService],
  exports: [WorkbenchService],
})
export class WorkbenchModule {}
