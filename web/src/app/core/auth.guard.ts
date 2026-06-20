import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from './session.service';

/** Redirect to /login unless a role is active. Loads the user directory first. */
export const authGuard: CanActivateFn = async () => {
  const session = inject(SessionService);
  const router = inject(Router);

  await session.ensureUsers();
  if (session.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};
