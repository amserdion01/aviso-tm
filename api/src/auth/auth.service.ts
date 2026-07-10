import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

/** Public shape of a user (never includes passwordHash). */
const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Email + password → signed JWT (8h) + the public user. */
  async login(email: string, parola: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    // Same error for unknown email and wrong password (no user enumeration).
    if (!user || !(await compare(parola, user.passwordHash))) {
      throw new UnauthorizedException('Email sau parolă incorecte.');
    }

    const token = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  /** The authenticated user's public profile (fresh from the DB). */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('Utilizatorul nu mai există.');
    }
    return user;
  }
}
