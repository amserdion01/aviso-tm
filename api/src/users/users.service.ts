import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** All users, ordered by role then name — backs the role switcher. */
  findAll() {
    return this.prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
  }
}
