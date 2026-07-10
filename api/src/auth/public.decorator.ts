import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a route as reachable WITHOUT a JWT (e.g. POST /auth/login). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
