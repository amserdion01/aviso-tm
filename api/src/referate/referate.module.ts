import { Module } from '@nestjs/common';
import { ReferateController } from './referate.controller';
import { ReferateService } from './referate.service';
import { WorkflowService } from './workflow.service';

@Module({
  controllers: [ReferateController],
  providers: [ReferateService, WorkflowService],
})
export class ReferateModule {}
