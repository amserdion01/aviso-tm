import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Role } from '@prisma/client';
import { WorkflowsService } from './workflows.service';
import { Roles } from '../auth/roles.decorator';
import { SaveStepsDto } from './dto/save-steps.dto';

@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  // GET /workflows — overview list with step counts.
  @Get()
  findAll() {
    return this.workflows.findAll();
  }

  // GET /workflows/active — the active workflow + steps (declared before :id).
  @Get('active')
  findActive() {
    return this.workflows.findActive();
  }

  // GET /workflows/:id — one workflow + ordered steps.
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.workflows.findOne(id);
  }

  // PUT /workflows/:id/steps — replace the entire ordered step list.
  // Only the Director General administers the approval flow.
  @Roles(Role.DIR_GENERAL)
  @Put(':id/steps')
  saveSteps(@Param('id') id: string, @Body() dto: SaveStepsDto) {
    return this.workflows.saveSteps(id, dto);
  }
}
