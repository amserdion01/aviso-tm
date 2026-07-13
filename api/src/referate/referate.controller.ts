import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ReferateService } from './referate.service';
import { WorkflowService } from './workflow.service';
import { AttachmentsService, MAX_FILE_BYTES } from './attachments.service';
import { renderReferatDocument } from './referat-document';
import { PdfService } from '../pdf/pdf.service';
import { AuthUser, CurrentUser } from '../auth/current-user.decorator';
import { CreateReferatDto } from './dto/create-referat.dto';
import { ApproveDto, CommentRequiredDto, SendBackDto } from './dto/action.dto';

/** All routes require a JWT (global guard); identity comes from the token. */
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

  // GET /referate/mine — the token user's own referate (declared before :id).
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.referate.mine(user.id);
  }

  // GET /referate — inbox for the authenticated user's role.
  @Get()
  inbox(@CurrentUser() user: AuthUser) {
    return this.referate.inboxForRole(user.role);
  }

  // GET /referate/:id — full detail + tasks + transitions.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.referate.findOne(id);
  }

  // POST /referate — create + materialize chain; requester = token user.
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReferatDto) {
    return this.workflow.create(dto, user.id);
  }

  // POST /referate/:id/resubmit — requester corrects a sent-back referat and
  // resubmits it; the chain is re-materialized and restarts at step 1.
  @Post(':id/resubmit')
  resubmit(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReferatDto,
  ) {
    return this.workflow.resubmit(id, user.id, dto);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ApproveDto,
  ) {
    return this.workflow.approve(id, user.id, dto);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CommentRequiredDto,
  ) {
    return this.workflow.reject(id, user.id, dto);
  }

  @Post(':id/send-back')
  sendBack(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: SendBackDto,
  ) {
    return this.workflow.sendBack(id, user.id, dto);
  }

  // GET /referate/:id/pdf — the referat as a print-ready A4 PDF (any state).
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

  // POST /referate/:id/atasamente — multipart upload; uploader = token user.
  @Post(':id/atasamente')
  @UseInterceptors(
    FilesInterceptor('files', 5, { limits: { fileSize: MAX_FILE_BYTES } }),
  )
  uploadAttachments(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.attachments.upload(id, user.id, files);
  }

  // GET /referate/:id/atasamente/:attId/download — presigned R2 URL as JSON.
  // (JSON instead of a 302 so the authenticated frontend can fetch it with the
  // Bearer header and then navigate top-level to the URL — no CORS on R2.)
  @Get(':id/atasamente/:attId/download')
  async downloadAttachment(
    @Param('id') id: string,
    @Param('attId') attId: string,
  ) {
    const url = await this.attachments.downloadUrl(id, attId);
    return { url };
  }
}
