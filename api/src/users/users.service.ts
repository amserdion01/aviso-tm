import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  /** Public user shape — NEVER include passwordHash. */
  private static readonly PUBLIC_SELECT = {
    id: true,
    name: true,
    email: true,
    role: true,
  } as const;

  constructor(private readonly prisma: PrismaService) {}

  /** All users (public fields only) — backs the demo roster on the login page. */
  findAll() {
    return this.prisma.user.findMany({
      select: UsersService.PUBLIC_SELECT,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }
}
