import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { PdfModule } from '../pdf/pdf.module';
import { ReferateController } from './referate.controller';
import { ReferateService } from './referate.service';
import { WorkflowService } from './workflow.service';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [StorageModule, PdfModule],
  controllers: [ReferateController],
  providers: [ReferateService, WorkflowService, AttachmentsService],
})
export class ReferateModule {}
