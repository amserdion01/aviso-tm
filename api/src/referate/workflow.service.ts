import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReferatStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { approvalChainFor } from '../config/workflow.config';
import { CreateReferatDto } from './dto/create-referat.dto';
import { ApproveDto, CommentRequiredDto } from './dto/action.dto';
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
   * Create a referat and materialize its approval chain from valoareLei.
   * The chain, the first WAITING task, and the creation Transition are all
   * written in a single transaction.
   */
  async create(dto: CreateReferatDto) {
    const requester = await this.prisma.user.findUnique({
      where: { id: dto.requesterId },
    });
    if (!requester) {
      throw new BadRequestException(
        `Utilizatorul solicitant ${dto.requesterId} nu există.`,
      );
    }

    const chain = approvalChainFor(dto.valoareLei);

    // Resolve one effective approver per role up front (a single query).
    const approvers = await this.prisma.user.findMany({
      where: { role: { in: chain } },
    });
    const approverByRole = new Map(approvers.map((u) => [u.role, u]));

    return this.prisma.$transaction(async (tx) => {
      const referat = await tx.referat.create({
        data: {
          articol: dto.articol,
          cantitate: dto.cantitate,
          justificare: dto.justificare,
          centruCost: dto.centruCost,
          valoareLei: dto.valoareLei,
          requesterId: requester.id,
          status: ReferatStatus.IN_ASTEPTARE,
          tasks: {
            create: chain.map((role, index) => ({
              stepOrder: index + 1,
              role,
              status: index === 0 ? TaskStatus.WAITING : TaskStatus.PENDING,
              effectiveApproverId: approverByRole.get(role)?.id ?? null,
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

  async approve(id: string, dto: ApproveDto) {
    return this.act(id, dto.actingUserId, dto.comment, 'APPROVE');
  }

  async reject(id: string, dto: CommentRequiredDto) {
    return this.act(id, dto.actingUserId, dto.comment, 'REJECT');
  }

  async sendBack(id: string, dto: CommentRequiredDto) {
    return this.act(id, dto.actingUserId, dto.comment, 'SEND_BACK');
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

    // Faked auth, but the acting role must match the active step's role.
    if (actingUser.role !== current.role) {
      throw new ForbiddenException(
        `Pasul activ necesită rolul ${current.role}, dar utilizatorul are rolul ${actingUser.role}.`,
      );
    }

    const fromState = referat.status;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      let toState: ReferatStatus;
      let note: string;

      if (action === 'APPROVE') {
        await tx.approvalTask.update({
          where: { id: current.id },
          data: {
            status: TaskStatus.APPROVED,
            actedById: actingUser.id,
            actedAt: now,
            comment: comment ?? null,
          },
        });

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
        await tx.approvalTask.update({
          where: { id: current.id },
          data: {
            status: TaskStatus.REJECTED,
            actedById: actingUser.id,
            actedAt: now,
            comment,
          },
        });
        toState = ReferatStatus.RESPINS;
        note = comment as string;
      } else {
        // SEND_BACK — re-activate the immediately previous step.
        await tx.approvalTask.update({
          where: { id: current.id },
          data: {
            status: TaskStatus.SENT_BACK,
            actedById: actingUser.id,
            actedAt: now,
            comment,
          },
        });

        const previous = this.previousTask(referat.tasks, current.stepOrder);
        if (previous) {
          // Reset the previous step so it genuinely awaits action again.
          await tx.approvalTask.update({
            where: { id: previous.id },
            data: {
              status: TaskStatus.WAITING,
              actedById: null,
              actedAt: null,
              comment: null,
            },
          });
        }
        // If there is no previous step, the referat returns to the requester.
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
