import { Module } from '@nestjs/common';
import { ZonasService } from './zonas.service';
import { TrackSyncService } from './track-sync.service';
import { ZonasController, SyncApiKeyGuard } from './zonas.controller';

@Module({
  controllers: [ZonasController],
  providers: [ZonasService, TrackSyncService, SyncApiKeyGuard],
  exports: [ZonasService],
})
export class ZonasModule {}
