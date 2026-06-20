import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import {
  APPROVAL_THRESHOLD_LEI,
  Referat,
  Role,
  ROLE_LABEL,
  ROLE_SHORT,
  STATUS_KEY,
  StatusKey,
} from '../../core/models';
import { LeiPipe, DataRoPipe, formatDataTimeRo } from '../../core/format';
import { IconComponent } from '../../shared/icon.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { StepperComponent, StepperStep, StepStatus } from '../../shared/stepper.component';
import {
  AuditTimelineComponent,
  AuditEvent,
  AuditType,
} from '../../shared/audit-timeline.component';

/** The preselected action carried by the `action` query param. */
type PreselectAction = 'back' | 'reject' | null;

/**
 * Detaliu referat — full requisition detail with the materialized approval
 * chain (stepper), the append-only istoric timeline, and a sticky action panel
 * that only lets the acting role decide on the WAITING step. Comment is required
 * for reject / send-back. Two-column, calm formal layout.
 */
@Component({
  selector: 'app-detaliu',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    LeiPipe,
    DataRoPipe,
    IconComponent,
    StatusBadgeComponent,
    StepperComponent,
    AuditTimelineComponent,
  ],
  templateUrl: './detaliu.component.html',
  styleUrl: './detaliu.component.scss',
})
export class DetaliuComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  // Exposed to the template.
  readonly ROLE_LABEL = ROLE_LABEL;
  readonly STATUS_KEY = STATUS_KEY;

  private readonly id = signal<string>('');
  readonly referat = signal<Referat | null>(null);
  readonly loading = signal(true);

  /** Preselected action (from the inbox quick actions), shown as a tinted note. */
  readonly preselect = signal<PreselectAction>(null);

  // Action panel form state — a control so Material renders the required error.
  readonly commentCtrl = new FormControl('', { nonNullable: true });

  private readonly commentInput =
    viewChild<ElementRef<HTMLTextAreaElement>>('commentInput');
  private autofocused = false;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.id.set(id);
    const action = this.route.snapshot.queryParamMap.get('action');
    this.preselect.set(action === 'back' || action === 'reject' ? action : null);

    // Clear the required error as soon as the user types.
    this.commentCtrl.valueChanges.subscribe((v) => {
      if (v.trim() && this.commentCtrl.hasError('required')) {
        this.commentCtrl.setErrors(null);
      }
    });

    // Autofocus the comment when arriving via a quick reject / send-back.
    effect(() => {
      const el = this.commentInput();
      if (el && this.preselect() && this.canAct() && !this.autofocused) {
        this.autofocused = true;
        el.nativeElement.focus();
      }
    });

    this.fetch();
  }

  // ---- Data loading ----------------------------------------------------------

  private fetch(): void {
    const id = this.id();
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.api.getOne(id).subscribe({
      next: (r) => {
        this.referat.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.referat.set(null);
        this.loading.set(false);
      },
    });
  }

  /** Re-fetch after an action so the stepper, istoric and panel stay in sync. */
  private reload(): void {
    this.fetch();
  }

  // ---- Derived view state ----------------------------------------------------

  /** Short human code from the cuid (the API has no "#YYYY-NNNN" code). */
  readonly shortCode = computed(() => {
    const r = this.referat();
    return r ? '#' + r.id.slice(0, 8).toUpperCase() : '';
  });

  readonly isFull = computed(
    () => (this.referat()?.valoareLei ?? 0) >= APPROVAL_THRESHOLD_LEI,
  );

  readonly statusKey = computed<StatusKey | null>(() => {
    const r = this.referat();
    return r ? STATUS_KEY[r.status] : null;
  });

  readonly pathLabel = computed(() =>
    this.isFull() ? 'Complet · ≥ 5.000 lei' : 'Scurt · < 5.000 lei',
  );

  readonly pathSub = computed(() =>
    this.isFull()
      ? 'Include avizarea Directorului economic și a Directorului general.'
      : 'Fără avizări de directori — achiziția se execută după Birou Achiziții.',
  );

  /** The single task currently awaiting a decision. */
  readonly waitingTask = computed(() =>
    this.referat()?.tasks?.find((t) => t.status === 'WAITING'),
  );

  readonly waitingRole = computed<Role | null>(() => this.waitingTask()?.role ?? null);

  /** The acting role may decide only on the step that is WAITING for that role. */
  readonly canAct = computed(() => {
    const w = this.waitingTask();
    return !!w && w.role === this.session.actingRole();
  });

  /** Tinted note copy for the preselected action (only while it can act). */
  readonly preselectNote = computed(() => {
    if (!this.canAct()) return '';
    switch (this.preselect()) {
      case 'reject':
        return 'Acțiune aleasă: Respinge — adaugă motivul mai jos.';
      case 'back':
        return 'Acțiune aleasă: Trimite înapoi — adaugă o observație.';
      default:
        return '';
    }
  });

  /** Message shown when the acting role has no available action. */
  readonly waitMsg = computed(() => {
    const r = this.referat();
    if (!r) return '';
    if (r.status === 'FINALIZAT') return 'Referat finalizat. Achiziția a fost realizată.';
    if (r.status === 'RESPINS')
      return 'Referatul a fost respins. Vezi motivul în istoric.';
    const w = this.waitingTask();
    if (w)
      return (
        'În așteptare la pasul: ' +
        ROLE_LABEL[w.role] +
        '. Nu ai o acțiune disponibilă pe acest referat.'
      );
    return 'Acest referat nu mai are pași activi.';
  });

  // ---- Stepper ---------------------------------------------------------------

  readonly stepperSteps = computed<StepperStep[]>(() => {
    const r = this.referat();
    if (!r) return [];
    const steps: StepperStep[] = [
      { label: 'Depunere', sublabel: r.requester?.name, status: 'done' },
    ];
    const tasks = [...(r.tasks ?? [])].sort((a, b) => a.stepOrder - b.stepOrder);
    for (const t of tasks) {
      steps.push({
        label: ROLE_SHORT[t.role],
        sublabel: t.effectiveApprover?.name ?? ROLE_LABEL[t.role],
        status: this.mapTaskStatus(t.status),
      });
    }
    if (r.status === 'FINALIZAT') {
      steps.push({ label: 'Finalizat', sublabel: 'Achiziții', status: 'done' });
    }
    return steps;
  });

  private mapTaskStatus(s: string): StepStatus {
    switch (s) {
      case 'APPROVED':
        return 'done';
      case 'REJECTED':
        return 'rejected';
      case 'SENT_BACK':
        return 'sentback';
      case 'WAITING':
        return 'current';
      default:
        return 'pending';
    }
  }

  // ---- Istoric (append-only audit trail) -------------------------------------

  readonly auditEvents = computed<AuditEvent[]>(() => {
    const r = this.referat();
    if (!r) return [];
    const transitions = [...(r.transitions ?? [])].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    return transitions.map((t) => {
      const type = this.auditType(t.fromState, t.toState);
      return {
        type,
        actor: t.actor?.name ?? '—',
        role: type === 'created' ? 'Solicitant' : t.actor ? ROLE_LABEL[t.actor.role] : '',
        action: this.auditAction(type),
        time: formatDataTimeRo(t.createdAt),
        comment: t.comment,
      } satisfies AuditEvent;
    });
  });

  private auditType(fromState: string | null, toState: string): AuditType {
    if (fromState == null) return 'created';
    switch (toState) {
      case 'FINALIZAT':
        return 'finalized';
      case 'RESPINS':
        return 'rejected';
      case 'TRIMIS_INAPOI':
        return 'sentback';
      default:
        // APROBAT or IN_ASTEPTARE → a step advanced.
        return 'approved';
    }
  }

  private auditAction(type: AuditType): string {
    switch (type) {
      case 'created':
        return 'a creat referatul';
      case 'approved':
        return 'a avizat referatul';
      case 'rejected':
        return 'a respins referatul';
      case 'sentback':
        return 'a trimis referatul înapoi';
      case 'finalized':
        return 'a finalizat referatul';
    }
  }

  // ---- Navigation ------------------------------------------------------------

  back(): void {
    this.router.navigate(['/toate']);
  }

  // ---- Actions ---------------------------------------------------------------

  private resetComment(): void {
    this.commentCtrl.reset('');
    this.preselect.set(null);
  }

  /** Flags the comment as required (visible mat-error) and focuses it. */
  private requireComment(): boolean {
    if (this.commentCtrl.value.trim()) return true;
    this.commentCtrl.setErrors({ required: true });
    this.commentCtrl.markAsTouched();
    this.commentInput()?.nativeElement.focus();
    return false;
  }

  approve(): void {
    const r = this.referat();
    const user = this.session.currentUser();
    if (!r || !user) return;
    const comment = this.commentCtrl.value.trim();
    this.api.approve(r.id, user.id, comment || undefined).subscribe({
      next: () => {
        this.resetComment();
        this.reload();
        this.session.refreshInboxCount();
        this.toast('Referat avizat.', 'tone-success');
      },
      error: () => this.toast('Acțiunea nu a putut fi finalizată.', 'tone-error'),
    });
  }

  reject(): void {
    const r = this.referat();
    const user = this.session.currentUser();
    if (!r || !user || !this.requireComment()) return;
    this.api.reject(r.id, user.id, this.commentCtrl.value.trim()).subscribe({
      next: () => {
        this.resetComment();
        this.reload();
        this.session.refreshInboxCount();
        this.toast('Referat respins.', 'tone-error');
      },
      error: () => this.toast('Acțiunea nu a putut fi finalizată.', 'tone-error'),
    });
  }

  sendBack(): void {
    const r = this.referat();
    const user = this.session.currentUser();
    if (!r || !user || !this.requireComment()) return;
    this.api.sendBack(r.id, user.id, this.commentCtrl.value.trim()).subscribe({
      next: () => {
        this.resetComment();
        this.reload();
        this.session.refreshInboxCount();
        this.toast(
          'Trimis înapoi — referatul s-a întors la pasul anterior.',
          'tone-warning',
        );
      },
      error: () => this.toast('Acțiunea nu a putut fi finalizată.', 'tone-error'),
    });
  }

  private toast(
    message: string,
    tone: 'tone-success' | 'tone-error' | 'tone-warning',
  ): void {
    this.snackBar.open(message, undefined, {
      duration: 3200,
      panelClass: ['aviso-toast', tone],
      horizontalPosition: 'right',
      verticalPosition: 'bottom',
    });
  }
}
