import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';

import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import { ViewportService } from '../../core/viewport.service';
import { Referat, ROLE_SHORT, STATUS_KEY, StatusKey } from '../../core/models';
import { LeiPipe, DataRoPipe } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { EmptyStateComponent } from '../../shared/empty-state.component';

/**
 * Referatele mele — the referate the signed-in user submitted, so a requester
 * can see where each of their requests stands (and correct one sent back to
 * them) instead of being blind to their own flow.
 */
@Component({
  selector: 'app-mele',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    MatButtonModule,
    LeiPipe,
    DataRoPipe,
    IconComponent,
    StatusBadgeComponent,
    EmptyStateComponent,
  ],
  templateUrl: './mele.component.html',
  styleUrl: './mele.component.scss',
})
export class MeleComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly isMobile = inject(ViewportService).isMobile;

  readonly referate = signal<Referat[]>([]);
  readonly loading = signal(true);
  /** Distinguishes "no requests yet" from "the load failed". */
  readonly loadError = signal(false);

  readonly displayedColumns = ['ref', 'art', 'val', 'pas', 'status'];

  readonly firstName = computed(
    () => this.session.currentUser()?.name?.split(' ')[0] ?? '',
  );

  constructor() {
    this.api.getMine().subscribe({
      next: (rows) => {
        this.referate.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  shortCode(r: Referat): string {
    return '#' + r.id.slice(0, 8).toUpperCase();
  }

  statusKey(r: Referat): StatusKey {
    return STATUS_KEY[r.status];
  }

  /** Human "who holds it now" hint for one of the user's referate. */
  currentStep(r: Referat): string {
    switch (r.status) {
      case 'FINALIZAT':
        return 'Finalizat';
      case 'RESPINS':
        return 'Respins';
      case 'TRIMIS_INAPOI':
        return 'Trimis înapoi ție';
      default: {
        const w = r.tasks?.find((t) => t.status === 'WAITING');
        if (!w) return '—';
        return (
          'La ' +
          ROLE_SHORT[w.role] +
          (w.effectiveApprover ? ` — ${w.effectiveApprover.name}` : '')
        );
      }
    }
  }

  isSentBack(r: Referat): boolean {
    return r.status === 'TRIMIS_INAPOI';
  }

  openDetail(r: Referat): void {
    this.router.navigate(['/referat', r.id]);
  }

  correct(r: Referat, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/referat', r.id, 'corectare']);
  }

  newReferat(): void {
    this.router.navigate(['/referat-nou']);
  }
}
