import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';
import { AuthUser } from './current-user.decorator';

/**
 * Global auth guard: every route requires a valid `Authorization: Bearer <jwt>`
 * unless marked @Public(). Routes marked @Roles(...) additionally require the
 * token's role to match. The verified payload lands on `req.user`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const header: string = request.headers?.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Autentificare necesară.');
    }

    let payload: { sub: string; email: string; name: string; role: Role };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Sesiune invalidă sau expirată.');
    }

    const user: AuthUser = {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
    request.user = user;

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles?.length && !roles.includes(user.role)) {
      throw new ForbiddenException(
        'Nu ai permisiunea necesară pentru această acțiune.',
      );
    }

    return true;
  }
}
