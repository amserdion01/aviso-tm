import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { Condition, Role, ROLE_LABEL, Workflow } from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

/** Simplified condition kinds exposed by the editor. */
type CondKind = 'always' | 'value_gte' | 'it' | 'ssm';

/** One editable step row (UI shape ↔ WorkflowStep). */
interface EditStep {
  role: Role;
  label: string;
  condKind: CondKind;
  threshold: number;
}

/** Roles that can approve a step (ANGAJAT is the requester, never an approver). */
const APPROVER_ROLES: Role[] = [
  'SEF_IERARHIC',
  'IT',
  'SSM',
  'ACHIZITII',
  'DIR_ECONOMIC',
  'DIR_GENERAL',
];

const COND_LABEL: Record<CondKind, string> = {
  always: 'Se aplică mereu',
  value_gte: 'Doar dacă valoarea ≥',
  it: 'Doar dacă necesită IT',
  ssm: 'Doar dacă necesită SSM',
};

/** Map a stored Condition to the editor's simplified kind + threshold. */
function toEdit(cond: Condition): { condKind: CondKind; threshold: number } {
  if (cond == null) return { condKind: 'always', threshold: 5000 };
  if ('field' in cond) {
    if (cond.field === 'valoareLei')
      return { condKind: 'value_gte', threshold: cond.value };
    if (cond.field === 'necesitaIt') return { condKind: 'it', threshold: 5000 };
    if (cond.field === 'necesitaSsm') return { condKind: 'ssm', threshold: 5000 };
  }
  // Advanced (all/any) conditions aren't editable here — treat as "always".
  return { condKind: 'always', threshold: 5000 };
}

/** Build a stored Condition from the editor's simplified kind + threshold. */
function toCondition(step: EditStep): Condition {
  switch (step.condKind) {
    case 'value_gte':
      return { field: 'valoareLei', op: 'gte', value: Number(step.threshold) || 0 };
    case 'it':
      return { field: 'necesitaIt', eq: true };
    case 'ssm':
      return { field: 'necesitaSsm', eq: true };
    default:
      return null;
  }
}

/**
 * Administrare flux — edit the ordered steps of the active workflow: role, label,
 * and an applicability condition per step, plus reorder/add/remove. Saving
 * replaces the whole step list (PUT /workflows/:id/steps).
 */
@Component({
  selector: 'app-admin-flux',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    IconComponent,
  ],
  templateUrl: './admin-flux.component.html',
  styleUrl: './admin-flux.component.scss',
})
export class AdminFluxComponent {
  private readonly api = inject(ApiService);
  private readonly snack = inject(MatSnackBar);

  readonly approverRoles = APPROVER_ROLES;
  readonly roleLabel = ROLE_LABEL;
  readonly condLabel = COND_LABEL;
  readonly condKinds: CondKind[] = ['always', 'value_gte', 'it', 'ssm'];

  private workflow: Workflow | null = null;
  readonly workflowName = signal('');
  readonly steps = signal<EditStep[]>([]);
  readonly saving = signal(false);

  constructor() {
    this.api.getActiveWorkflow().subscribe((wf) => this.load(wf));
  }

  private load(wf: Workflow): void {
    this.workflow = wf;
    this.workflowName.set(wf.name);
    this.steps.set(
      wf.steps.map((s) => ({
        role: s.role,
        label: s.label,
        ...toEdit(s.appliesWhen),
      })),
    );
  }

  addStep(): void {
    this.steps.update((list) => [
      ...list,
      { role: 'SEF_IERARHIC', label: '', condKind: 'always', threshold: 5000 },
    ]);
  }

  removeStep(index: number): void {
    this.steps.update((list) => list.filter((_, i) => i !== index));
  }

  moveUp(index: number): void {
    if (index === 0) return;
    this.swap(index, index - 1);
  }

  moveDown(index: number): void {
    if (index === this.steps().length - 1) return;
    this.swap(index, index + 1);
  }

  private swap(a: number, b: number): void {
    this.steps.update((list) => {
      const next = [...list];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }

  save(): void {
    if (!this.workflow) return;
    const list = this.steps();
    if (list.length === 0) {
      this.toast('Fluxul trebuie să aibă cel puțin un pas.', 'tone-error');
      return;
    }
    if (list.some((s) => !s.label.trim())) {
      this.toast('Fiecare pas trebuie să aibă o etichetă.', 'tone-error');
      return;
    }

    const payload = list.map((s, index) => ({
      order: index + 1,
      role: s.role,
      label: s.label.trim(),
      appliesWhen: toCondition(s),
    }));

    this.saving.set(true);
    this.api.saveSteps(this.workflow.id, payload).subscribe({
      next: (wf) => {
        this.saving.set(false);
        this.load(wf);
        this.toast('Fluxul de avizare a fost salvat.', 'tone-success');
      },
      error: () => {
        this.saving.set(false);
        this.toast('Salvarea a eșuat. Verifică pașii și încearcă din nou.', 'tone-error');
      },
    });
  }

  private toast(message: string, tone: 'tone-success' | 'tone-error'): void {
    this.snack.open(message, undefined, {
      duration: 4000,
      panelClass: ['aviso-toast', tone],
    });
  }
}
