import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReferatStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { applies, Condition, RoutingContext } from '../config/condition';
import { CreateReferatDto } from './dto/create-referat.dto';
import { ApproveDto, CommentRequiredDto, SendBackDto } from './dto/action.dto';
import { REFERAT_INCLUDE } from './referate.service';

/** A task is "open" (re-activatable) when PENDING or after a SENT_BACK. */
const OPEN_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.SENT_BACK,
];

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a referat and materialize its approval chain from the active
   * Workflow: each step whose `appliesWhen` condition matches the referat
   * becomes a task, in order. The chain, the first WAITING task, and the
   * creation Transition are all written in a single transaction.
   */
  async create(dto: CreateReferatDto, requesterId: string) {
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
    });
    if (!requester) {
      throw new BadRequestException(
        `Utilizatorul solicitant ${requesterId} nu există.`,
      );
    }

    // Evaluate each step's condition against this referat; keep only those that apply.
    const ctx: RoutingContext = {
      valoareLei: dto.valoareLei,
      necesitaIt: dto.necesitaIt ?? false,
      necesitaSsm: dto.necesitaSsm ?? false,
    };
    const { workflowId, chain, approverByRole } = await this.resolveChain(ctx);

    return this.prisma.$transaction(async (tx) => {
      const referat = await tx.referat.create({
        data: {
          articol: dto.articol,
          cantitate: dto.cantitate,
          justificare: dto.justificare,
          centruCost: dto.centruCost,
          valoareLei: dto.valoareLei,
          necesitaIt: ctx.necesitaIt,
          necesitaSsm: ctx.necesitaSsm,
          requesterId: requester.id,
          workflowId,
          status: ReferatStatus.IN_ASTEPTARE,
          tasks: {
            // Re-number to a contiguous 1..n stepOrder over the applicable steps.
            create: chain.map((step, index) => ({
              stepOrder: index + 1,
              role: step.role,
              status: index === 0 ? TaskStatus.WAITING : TaskStatus.PENDING,
              effectiveApproverId: approverByRole.get(step.role)?.id ?? null,
            })),
          },
        },
      });

      await tx.transition.create({
        data: {
          referatId: referat.id,
          fromState: null,
          toState: ReferatStatus.IN_ASTEPTARE,
          actorId: requester.id,
          comment: 'Referat creat și trimis spre aprobare.',
        },
      });

      return tx.referat.findUniqueOrThrow({
        where: { id: referat.id },
        include: REFERAT_INCLUDE,
      });
    });
  }

  /**
   * Correct-and-resubmit a referat that was sent back to its requester
   * (status TRIMIS_INAPOI). Only the requester may do this. The editable
   * fields are updated and the approval chain is re-materialized from the
   * active workflow (value/flag edits can legitimately change the route), so
   * the flow restarts cleanly at step 1. The append-only Transition trail is
   * preserved; only the (non-audit) ApprovalTask rows are rebuilt.
   */
  async resubmit(id: string, requesterId: string, dto: CreateReferatDto) {
    const referat = await this.prisma.referat.findUnique({ where: { id } });
    if (!referat) {
      throw new NotFoundException(`Referatul ${id} nu există.`);
    }
    if (referat.requesterId !== requesterId) {
      throw new ForbiddenException(
        'Doar solicitantul poate corecta și retrimite referatul.',
      );
    }
    if (referat.status !== ReferatStatus.TRIMIS_INAPOI) {
      throw new ConflictException(
        'Doar un referat trimis înapoi poate fi corectat și retrimis.',
      );
    }

    const ctx: RoutingContext = {
      valoareLei: dto.valoareLei,
      necesitaIt: dto.necesitaIt ?? false,
      necesitaSsm: dto.necesitaSsm ?? false,
    };
    const { workflowId, chain, approverByRole } = await this.resolveChain(ctx);

    return this.prisma.$transaction(async (tx) => {
      // Rebuild the chain from scratch (tasks are not the audit trail).
      await tx.approvalTask.deleteMany({ where: { referatId: id } });
      await tx.referat.update({
        where: { id },
        data: {
          articol: dto.articol,
          cantitate: dto.cantitate,
          justificare: dto.justificare,
          centruCost: dto.centruCost,
          valoareLei: dto.valoareLei,
          necesitaIt: ctx.necesitaIt,
          necesitaSsm: ctx.necesitaSsm,
          workflowId,
          status: ReferatStatus.IN_ASTEPTARE,
          tasks: {
            create: chain.map((step, index) => ({
              stepOrder: index + 1,
              role: step.role,
              status: index === 0 ? TaskStatus.WAITING : TaskStatus.PENDING,
              effectiveApproverId: approverByRole.get(step.role)?.id ?? null,
            })),
          },
        },
      });

      await tx.transition.create({
        data: {
          referatId: id,
          fromState: ReferatStatus.TRIMIS_INAPOI,
          toState: ReferatStatus.IN_ASTEPTARE,
          actorId: requesterId,
          comment: 'Referat corectat și retrimis spre aprobare.',
        },
      });

      return tx.referat.findUniqueOrThrow({
        where: { id },
        include: REFERAT_INCLUDE,
      });
    });
  }

  /**
   * Load the active workflow and materialize the ordered chain for a given
   * routing context: the applicable steps plus one deterministic effective
   * approver per role. Shared by create() and resubmit().
   */
  private async resolveChain(ctx: RoutingContext) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!workflow || workflow.steps.length === 0) {
      throw new BadRequestException(
        'Niciun flux de avizare activ nu este configurat.',
      );
    }

    const chain = workflow.steps.filter((step) =>
      applies(step.appliesWhen as Condition, ctx),
    );
    if (chain.length === 0) {
      throw new BadRequestException(
        'Fluxul activ nu produce niciun pas pentru acest referat.',
      );
    }

    // Deterministic effective approver per role (stable order, not query luck).
    const approvers = await this.prisma.user.findMany({
      where: { role: { in: chain.map((s) => s.role) } },
      orderBy: { name: 'asc' },
    });
    const approverByRole = new Map(approvers.map((u) => [u.role, u]));

    return { workflowId: workflow.id, chain, approverByRole };
  }

  async approve(id: string, actingUserId: string, dto: ApproveDto) {
    return this.act(id, actingUserId, dto.comment, 'APPROVE');
  }

  async reject(id: string, actingUserId: string, dto: CommentRequiredDto) {
    return this.act(id, actingUserId, dto.comment, 'REJECT');
  }

  async sendBack(id: string, actingUserId: string, dto: SendBackDto) {
    return this.act(id, actingUserId, dto.comment, 'SEND_BACK', dto.sendBackTo);
  }

  /**
   * Single entry point for the three mutating actions. Loads the referat and
   * its current WAITING task, validates the acting user, then advances the
   * workflow AND writes the Transition row inside one transaction.
   */
  private async act(
    id: string,
    actingUserId: string,
    comment: string | undefined,
    action: 'APPROVE' | 'REJECT' | 'SEND_BACK',
    sendBackTo?: number,
  ) {
    const referat = await this.prisma.referat.findUnique({
      where: { id },
      include: { tasks: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!referat) {
      throw new NotFoundException(`Referatul ${id} nu există.`);
    }

    const actingUser = await this.prisma.user.findUnique({
      where: { id: actingUserId },
    });
    if (!actingUser) {
      throw new BadRequestException(
        `Utilizatorul ${actingUserId} nu există.`,
      );
    }

    const current = referat.tasks.find(
      (t) => t.status === TaskStatus.WAITING,
    );
    if (!current) {
      throw new ConflictException(
        'Referatul nu are un pas activ — fluxul este deja încheiat.',
      );
    }

    // Real auth upstream; the acting role must still match the active step's role.
    if (actingUser.role !== current.role) {
      throw new ForbiddenException(
        `Pasul activ necesită rolul ${current.role}, dar utilizatorul are rolul ${actingUser.role}.`,
      );
    }

    // SEND_BACK: resolve + validate the target before the transaction.
    // - sendBackTo === 0  → all the way back to the requester (no active step);
    // - sendBackTo >= 1   → ANY earlier step;
    // - omitted           → the previous step (default).
    let sendBackDest: { id: string; stepOrder: number } | undefined;
    let toRequester = false;
    if (action === 'SEND_BACK') {
      if (sendBackTo === 0) {
        toRequester = true;
      } else if (sendBackTo != null) {
        sendBackDest = referat.tasks.find((t) => t.stepOrder === sendBackTo);
        if (!sendBackDest || sendBackDest.stepOrder >= current.stepOrder) {
          throw new BadRequestException(
            'Pasul ales nu este un pas anterior valid.',
          );
        }
      } else {
        sendBackDest = this.previousTask(referat.tasks, current.stepOrder);
      }
    }

    const fromState = referat.status;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      let toState: ReferatStatus;
      let note: string;

      if (action === 'APPROVE') {
        // Guard against a concurrent action on the same step: only transition
        // the task while it is still WAITING. If another request won the race,
        // count is 0 → abort the whole transaction (no duplicate transition).
        const claimed = await tx.approvalTask.updateMany({
          where: { id: current.id, status: TaskStatus.WAITING },
          data: {
            status: TaskStatus.APPROVED,
            actedById: actingUser.id,
            actedAt: now,
            comment: comment ?? null,
          },
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'Pasul a fost deja procesat între timp — reîncarcă referatul.',
          );
        }

        const next = this.nextOpenTask(referat.tasks, current.stepOrder);
        if (next) {
          await tx.approvalTask.update({
            where: { id: next.id },
            data: { status: TaskStatus.WAITING },
          });
          toState = ReferatStatus.IN_ASTEPTARE;
        } else {
          toState = ReferatStatus.FINALIZAT;
        }
        note = comment ?? `Aprobat de ${current.role}.`;
      } else if (action === 'REJECT') {
        const claimed = await tx.approvalTask.updateMany({
          where: { id: current.id, status: TaskStatus.WAITING },
          data: {
            status: TaskStatus.REJECTED,
            actedById: actingUser.id,
            actedAt: now,
            comment,
          },
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'Pasul a fost deja procesat între timp — reîncarcă referatul.',
          );
        }
        toState = ReferatStatus.RESPINS;
        note = comment as string;
      } else {
        // SEND_BACK — re-activate the chosen earlier step (default: previous).
        const claimed = await tx.approvalTask.updateMany({
          where: { id: current.id, status: TaskStatus.WAITING },
          data: {
            status: TaskStatus.SENT_BACK,
            actedById: actingUser.id,
            actedAt: now,
            comment,
          },
        });
        if (claimed.count !== 1) {
          throw new ConflictException(
            'Pasul a fost deja procesat între timp — reîncarcă referatul.',
          );
        }

        if (sendBackDest) {
          // Steps between the destination and the current one were approved on
          // the abandoned pass — reset them so the chain re-walks forward.
          await tx.approvalTask.updateMany({
            where: {
              referatId: referat.id,
              stepOrder: {
                gt: sendBackDest.stepOrder,
                lt: current.stepOrder,
              },
              status: TaskStatus.APPROVED,
            },
            data: {
              status: TaskStatus.PENDING,
              actedById: null,
              actedAt: null,
              comment: null,
            },
          });

          // Reset the destination so it genuinely awaits action again.
          await tx.approvalTask.update({
            where: { id: sendBackDest.id },
            data: {
              status: TaskStatus.WAITING,
              actedById: null,
              actedAt: null,
              comment: null,
            },
          });
        } else if (toRequester) {
          // Back to the requester from any step: clear every earlier approval so
          // the chain visibly restarts. No task is left WAITING; the requester
          // corrects + resubmits (which re-materializes the chain from step 1).
          await tx.approvalTask.updateMany({
            where: {
              referatId: referat.id,
              stepOrder: { lt: current.stepOrder },
              status: TaskStatus.APPROVED,
            },
            data: {
              status: TaskStatus.PENDING,
              actedById: null,
              actedAt: null,
              comment: null,
            },
          });
        }
        // No active step left (dest re-activated above, or returned to requester).
        toState = ReferatStatus.TRIMIS_INAPOI;
        note = comment as string;
      }

      await tx.referat.update({
        where: { id: referat.id },
        data: { status: toState },
      });

      await tx.transition.create({
        data: {
          referatId: referat.id,
          fromState,
          toState,
          actorId: actingUser.id,
          comment: note,
        },
      });

      return tx.referat.findUniqueOrThrow({
        where: { id: referat.id },
        include: REFERAT_INCLUDE,
      });
    });
  }

  /** Smallest stepOrder strictly after `afterOrder` that is still open. */
  private nextOpenTask(
    tasks: { stepOrder: number; status: TaskStatus; id: string }[],
    afterOrder: number,
  ) {
    return tasks
      .filter(
        (t) =>
          t.stepOrder > afterOrder && OPEN_TASK_STATUSES.includes(t.status),
      )
      .sort((a, b) => a.stepOrder - b.stepOrder)[0];
  }

  /** Largest stepOrder strictly before `beforeOrder`. */
  private previousTask(
    tasks: { stepOrder: number; status: TaskStatus; id: string }[],
    beforeOrder: number,
  ) {
    return tasks
      .filter((t) => t.stepOrder < beforeOrder)
      .sort((a, b) => b.stepOrder - a.stepOrder)[0];
  }
}
