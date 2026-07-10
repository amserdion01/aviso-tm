import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Redirect,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { ReferateService } from './referate.service';
import { WorkflowService } from './workflow.service';
import { AttachmentsService, MAX_FILE_BYTES } from './attachments.service';
import { renderReferatDocument } from './referat-document';
import { PdfService } from '../pdf/pdf.service';
import { CreateReferatDto } from './dto/create-referat.dto';
import { ApproveDto, CommentRequiredDto } from './dto/action.dto';

@Controller('referate')
export class ReferateController {
  constructor(
    private readonly referate: ReferateService,
    private readonly workflow: WorkflowService,
    private readonly attachments: AttachmentsService,
    private readonly pdf: PdfService,
  ) {}

  // GET /referate/all — overview list (declared before :id to avoid capture).
  @Get('all')
  findAll() {
    return this.referate.findAll();
  }

  // GET /referate?role=... — inbox for a role.
  @Get()
  inbox(@Query('role') role?: string) {
    if (!role || !(role in Role)) {
      throw new BadRequestException(
        `Parametrul "role" este obligatoriu și trebuie să fie unul dintre: ${Object.keys(Role).join(', ')}.`,
      );
    }
    return this.referate.inboxForRole(role as Role);
  }

  // GET /referate/:id — full detail + tasks + transitions.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.referate.findOne(id);
  }

  // POST /referate — create + materialize chain.
  @Post()
  create(@Body() dto: CreateReferatDto) {
    return this.workflow.create(dto);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveDto) {
    return this.workflow.approve(id, dto);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: CommentRequiredDto) {
    return this.workflow.reject(id, dto);
  }

  @Post(':id/send-back')
  sendBack(@Param('id') id: string, @Body() dto: CommentRequiredDto) {
    return this.workflow.sendBack(id, dto);
  }

  // POST /referate/:id/atasamente — multipart upload (max 5 files, 10 MB each).
  @Post(':id/atasamente')
  @UseInterceptors(
    FilesInterceptor('files', 5, { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  uploadAttachments(
    @Param('id') id: string,
    @Body('actingUserId') actingUserId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!actingUserId) {
      throw new BadRequestException('Câmpul "actingUserId" este obligatoriu.');
    }
    return this.attachments.upload(id, actingUserId, files);
  }

  // GET /referate/:id/pdf — the referat as a print-ready A4 PDF (any state, any caller).
  @Get(':id/pdf')
  async pdfDocument(@Param('id') id: string): Promise<StreamableFile> {
    const referat = await this.referate.findOne(id);
    const html = renderReferatDocument(referat, new Date());
    const pdf = await this.pdf.htmlToPdf(html);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="referat-${id.slice(0, 8)}.pdf"`,
    });
  }

  // GET /referate/:id/atasamente/:attId/download — 302 to a presigned R2 URL.
  @Get(':id/atasamente/:attId/download')
  @Redirect()
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attId') attId: string,
  ) {
    const url = await this.attachments.downloadUrl(id, attId);
    return { url, statusCode: 302 };
  }
}
