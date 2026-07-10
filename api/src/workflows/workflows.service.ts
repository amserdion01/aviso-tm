import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaveStepsDto } from './dto/save-steps.dto';

/** Include the ordered steps alongside a workflow. */
const WORKFLOW_INCLUDE = {
  steps: { orderBy: { order: 'asc' } },
} satisfies Prisma.WorkflowInclude;

@Injectable()
export class WorkflowsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Overview list: every workflow with its step count. */
  findAll() {
    return this.prisma.workflow.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { steps: true } } },
    });
  }

  /** The single active workflow + ordered steps (drives new referate). */
  async findActive() {
    const workflow = await this.prisma.workflow.findFirst({
      where: { isActive: true },
      include: WORKFLOW_INCLUDE,
    });
    if (!workflow) {
      throw new NotFoundException('Niciun flux de avizare activ.');
    }
    return workflow;
  }

  async findOne(id: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id },
      include: WORKFLOW_INCLUDE,
    });
    if (!workflow) {
      throw new NotFoundException(`Fluxul ${id} nu există.`);
    }
    return workflow;
  }

  /**
   * Replace the entire ordered step list of a workflow. Wipes the existing
   * steps and recreates them from the payload in one transaction, re-numbering
   * to a contiguous 1..n order so the admin can freely reorder/add/remove.
   */
  async saveSteps(id: string, dto: SaveStepsDto) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id } });
    if (!workflow) {
      throw new NotFoundException(`Fluxul ${id} nu există.`);
    }

    const ordered = [...dto.steps].sort((a, b) => a.order - b.order);
    if (ordered.some((s) => !s.label.trim())) {
      throw new BadRequestException('Fiecare pas trebuie să aibă o etichetă.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workflowStep.deleteMany({ where: { workflowId: id } });
      await tx.workflowStep.createMany({
        data: ordered.map((step, index) => ({
          workflowId: id,
          order: index + 1,
          role: step.role,
          label: step.label.trim(),
          appliesWhen:
            step.appliesWhen == null
              ? Prisma.JsonNull
              : (step.appliesWhen as Prisma.InputJsonValue),
        })),
      });
    });

    return this.findOne(id);
  }
}
