import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { SessionService } from './session.service';

/**
 * Attaches `Authorization: Bearer <jwt>` to every API call and reacts to 401s
 * (expired/invalid token) by clearing the session and returning to /login.
 * 401s from the login call itself pass through — the form shows the error.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionService);
  const router = inject(Router);

  const token = session.token();
  const authedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authedReq).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        !req.url.includes('/auth/login')
      ) {
        session.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
