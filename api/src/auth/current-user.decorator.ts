import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

/** The JWT payload the guard attaches to the request. */
export interface AuthUser {
  /** User id (JWT `sub`). */
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Injects the authenticated user (from the verified JWT) into a handler param. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthUser;
  },
);
