import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';

import { ApiService } from '../../core/api.service';
import { ViewportService } from '../../core/viewport.service';
import { APPROVAL_THRESHOLD_LEI, Referat, STATUS_KEY, StatusKey } from '../../core/models';
import { LeiPipe, DataRoPipe } from '../../core/format';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { BadgeComponent } from '../../shared/badge.component';

/**
 * Toate referatele — read-only overview of every referat in the system.
 * Status legend + a Material table mirroring the inbox styling. Row click opens
 * the detail screen.
 */
@Component({
  selector: 'app-toate',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatTableModule,
    LeiPipe,
    DataRoPipe,
    StatusBadgeComponent,
    BadgeComponent,
  ],
  templateUrl: './toate.component.html',
  styleUrl: './toate.component.scss',
})
export class ToateComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  /** Exposed to the template. */
  readonly APPROVAL_THRESHOLD_LEI = APPROVAL_THRESHOLD_LEI;
  readonly STATUS_KEY = STATUS_KEY;

  /** Phone viewport → stacked cards instead of the table. */
  readonly isMobile = inject(ViewportService).isMobile;

  readonly referate = signal<Referat[]>([]);

  readonly displayedColumns = ['ref', 'art', 'sol', 'val', 'path', 'status'];

  constructor() {
    this.api.getAll().subscribe({
      next: (rows) => this.referate.set(rows),
      error: () => this.referate.set([]),
    });
  }

  /** Short code derived from the cuid (the API has no human "#YYYY-NNNN" code). */
  shortCode(referat: Referat): string {
    return '#' + referat.id.slice(0, 8).toUpperCase();
  }

  /** Typed status-key lookup (mat-table row context is untyped). */
  statusKey(referat: Referat): StatusKey {
    return STATUS_KEY[referat.status];
  }

  openDetail(referat: Referat): void {
    this.router.navigate(['/referat', referat.id]);
  }
}
