import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Public user fields — NEVER expose passwordHash in any referat response. */
const USER_PUBLIC = {
  select: { id: true, name: true, email: true, role: true },
} satisfies { select: Prisma.UserSelect };

/** Shared include shape so list/detail responses are consistent. */
const REFERAT_INCLUDE = {
  requester: USER_PUBLIC,
  tasks: {
    orderBy: { stepOrder: 'asc' },
    include: { effectiveApprover: USER_PUBLIC, actedBy: USER_PUBLIC },
  },
  transitions: {
    orderBy: { createdAt: 'asc' },
    include: { actor: USER_PUBLIC },
  },
  attachments: {
    orderBy: { createdAt: 'asc' },
    include: { uploadedBy: USER_PUBLIC },
  },
} satisfies Prisma.ReferatInclude;

@Injectable()
export class ReferateService {
  constructor(private readonly prisma: PrismaService) {}

  /** Inbox: referate that currently have a WAITING task for the given role. */
  inboxForRole(role: Role) {
    return this.prisma.referat.findMany({
      where: { tasks: { some: { role, status: 'WAITING' } } },
      include: REFERAT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Overview list of every referat with its status. */
  findAll() {
    return this.prisma.referat.findMany({
      include: REFERAT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** The referate the given user submitted (their own requests). */
  mine(userId: string) {
    return this.prisma.referat.findMany({
      where: { requesterId: userId },
      include: REFERAT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Full detail: data + tasks + transitions (istoric). */
  async findOne(id: string) {
    const referat = await this.prisma.referat.findUnique({
      where: { id },
      include: REFERAT_INCLUDE,
    });
    if (!referat) {
      throw new NotFoundException(`Referatul ${id} nu există.`);
    }
    return referat;
  }
}

export { REFERAT_INCLUDE };
