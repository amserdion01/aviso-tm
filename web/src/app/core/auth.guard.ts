import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

/**
 * Redirect to /login unless a valid JWT session exists. Loads the profile
 * (GET /auth/me) for a stored token, which also weeds out expired tokens.
 */
export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);

  const user = await session.ensureUser();
  if (user) {
    return true;
  }
  return router.createUrlTree(['/login']);
};
