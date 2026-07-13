import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'inbox', pathMatch: 'full' },
      {
        path: 'inbox',
        loadComponent: () =>
          import('./features/inbox/inbox.component').then((m) => m.InboxComponent),
      },
      {
        path: 'mele',
        loadComponent: () =>
          import('./features/mele/mele.component').then((m) => m.MeleComponent),
      },
      {
        path: 'referat-nou',
        loadComponent: () =>
          import('./features/referat-nou/referat-nou.component').then(
            (m) => m.ReferatNouComponent,
          ),
      },
      {
        // Correct-and-resubmit a sent-back referat (reuses the referat form).
        path: 'referat/:id/corectare',
        loadComponent: () =>
          import('./features/referat-nou/referat-nou.component').then(
            (m) => m.ReferatNouComponent,
          ),
      },
      {
        path: 'toate',
        loadComponent: () =>
          import('./features/toate/toate.component').then((m) => m.ToateComponent),
      },
      {
        path: 'referat/:id',
        loadComponent: () =>
          import('./features/detaliu/detaliu.component').then((m) => m.DetaliuComponent),
      },
      {
        path: 'admin/flux',
        loadComponent: () =>
          import('./features/admin/admin-flux.component').then((m) => m.AdminFluxComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
