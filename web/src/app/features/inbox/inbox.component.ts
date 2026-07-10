import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import { ViewportService } from '../../core/viewport.service';
import { ApprovalTask, Referat, ROLE_SHORT } from '../../core/models';
import { LeiPipe, DataRoPipe } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { BadgeComponent } from '../../shared/badge.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';

/**
 * Inboxul meu — referate awaiting the acting role's decision.
 * Material table with quick Aprobă / Trimite înapoi / Respinge actions,
 * plus a reassuring empty state. Reloads whenever the acting role changes.
 */
@Component({
  selector: 'app-inbox',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    MatTableModule,
    MatButtonModule,
    LeiPipe,
    DataRoPipe,
    IconComponent,
    StatusBadgeComponent,
    BadgeComponent,
    EmptyStateComponent,
  ],
  templateUrl: './inbox.component.html',
  styleUrl: './inbox.component.scss',
})
export class InboxComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  /** Exposed to the template for the "Pas curent" badge. */
  readonly ROLE_SHORT = ROLE_SHORT;

  /** Phone viewport → stacked cards instead of the table. */
  readonly isMobile = inject(ViewportService).isMobile;

  readonly currentUser = this.session.currentUser;
  /** The authenticated user's role (drives the empty-state copy). */
  readonly actingRole = () => this.session.currentUser()?.role ?? null;

  readonly referate = signal<Referat[]>([]);
  readonly loading = signal(false);

  readonly displayedColumns = ['ref', 'sol', 'art', 'val', 'pas', 'act'];

  constructor() {
    // Load on init and re-load if the session user changes (fresh login).
    effect(() => {
      if (!this.currentUser()) {
        this.referate.set([]);
        return;
      }
      this.fetch();
    });
  }

  private fetch(): void {
    this.loading.set(true);
    this.api.getInbox().subscribe({
      next: (rows) => {
        this.referate.set(rows);
        // Keep the shared nav badge exactly in sync with the loaded list.
        this.session.inboxCount.set(rows.length);
        this.loading.set(false);
      },
      error: () => {
        this.referate.set([]);
        this.loading.set(false);
      },
    });
  }

  /** Short code derived from the cuid (the API has no human "#YYYY-NNNN" code). */
  shortCode(referat: Referat): string {
    return '#' + referat.id.slice(0, 8).toUpperCase();
  }

  /** The single task currently awaiting a decision. */
  waitingTask(referat: Referat): ApprovalTask | undefined {
    return referat.tasks?.find((t) => t.status === 'WAITING');
  }

  openDetail(referat: Referat): void {
    this.router.navigate(['/referat', referat.id]);
  }

  /** Quick approve as the authenticated user; refresh + toast on success. */
  approve(referat: Referat, event?: Event): void {
    event?.stopPropagation();
    this.api.approve(referat.id).subscribe({
      next: () => {
        this.fetch();
        this.toast('Referat avizat.', 'tone-success');
      },
      error: () => {
        this.toast('Acțiunea nu a putut fi finalizată.', 'tone-error');
      },
    });
  }

  /** Send-back / reject require a comment → handled on the detail screen. */
  goToAction(referat: Referat, action: 'back' | 'reject', event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/referat', referat.id], { queryParams: { action } });
  }

  private toast(message: string, tone: 'tone-success' | 'tone-error'): void {
    this.snackBar.open(message, undefined, {
      duration: 3200,
      panelClass: ['aviso-toast', tone],
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }
}
