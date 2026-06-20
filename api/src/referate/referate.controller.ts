import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReferateService } from './referate.service';
import { WorkflowService } from './workflow.service';
import { CreateReferatDto } from './dto/create-referat.dto';
import { ApproveDto, CommentRequiredDto } from './dto/action.dto';

@Controller('referate')
export class ReferateController {
  constructor(
    private readonly referate: ReferateService,
    private readonly workflow: WorkflowService,
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
}
