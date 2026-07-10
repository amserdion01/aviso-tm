import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { BytesPipe } from '../../core/format';
import {
  appliesClient,
  CreateReferatPayload,
  ROLE_SHORT,
  Workflow,
} from '../../core/models';
import { IconComponent } from '../../shared/icon.component';

/** Cost centres offered in the form (matches the design handoff). */
const CENTRU_OPTIONS = [
  'Birou IT',
  'Stație captare',
  'Stație tratare',
  'Mentenanță rețea',
  'Laborator',
  'Administrativ',
] as const;

/** Strongly-typed shape of the requisition form. */
interface ReferatForm {
  articol: FormControl<string>;
  cantitate: FormControl<number | null>;
  centruCost: FormControl<string>;
  justificare: FormControl<string>;
  valoareLei: FormControl<number | null>;
  necesitaIt: FormControl<boolean>;
  necesitaSsm: FormControl<boolean>;
}

@Component({
  selector: 'app-referat-nou',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatCheckboxModule,
    IconComponent,
    BytesPipe,
  ],
  templateUrl: './referat-nou.component.html',
  styleUrl: './referat-nou.component.scss',
})
export class ReferatNouComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);

  readonly centruOptions = CENTRU_OPTIONS;

  /** The active workflow, loaded once — drives the live routing preview. */
  private readonly workflow = signal<Workflow | null>(null);

  /** Files picked for upload (sent right after the referat is created). */
  readonly selectedFiles = signal<File[]>([]);

  readonly form = this.fb.group<ReferatForm>({
    articol: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    cantitate: this.fb.control<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),
    centruCost: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    justificare: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    valoareLei: this.fb.control<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),
    necesitaIt: this.fb.control(false, { nonNullable: true }),
    necesitaSsm: this.fb.control(false, { nonNullable: true }),
  });

  /** Live form values that drive the routing preview. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  /**
   * The effective approval chain (short role labels) for the current value +
   * flags, resolved from the active workflow's conditions. Empty until a value
   * is entered. This is the live, workflow-driven replacement for the old
   * fixed short/full banner.
   */
  readonly previewSteps = computed<string[]>(() => {
    const wf = this.workflow();
    const v = this.form.controls.valoareLei.value;
    void this.formValue(); // re-run on any form change (value + checkboxes)
    if (!wf || v == null || v <= 0) return [];
    const ctx = {
      valoareLei: Number(v),
      necesitaIt: this.form.controls.necesitaIt.value,
      necesitaSsm: this.form.controls.necesitaSsm.value,
    };
    return wf.steps
      .filter((s) => appliesClient(s.appliesWhen, ctx))
      .map((s) => ROLE_SHORT[s.role]);
  });

  constructor() {
    this.api.getActiveWorkflow().subscribe((wf) => this.workflow.set(wf));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CreateReferatPayload = {
      articol: raw.articol.trim(),
      cantitate: Number(raw.cantitate),
      justificare: raw.justificare.trim(),
      centruCost: raw.centruCost,
      valoareLei: Number(raw.valoareLei),
      necesitaIt: raw.necesitaIt,
      necesitaSsm: raw.necesitaSsm,
    };

    this.api.create(payload).subscribe((created) => {
      const files = this.selectedFiles();
      if (files.length === 0) {
        this.afterCreate(created.id);
        return;
      }
      // The referat exists; attach the files, then navigate either way.
      this.api.uploadAttachments(created.id, files).subscribe({
        next: () => this.afterCreate(created.id),
        error: () => {
          this.snack.open(
            'Referatul a fost creat, dar fișierele nu au putut fi încărcate.',
            undefined,
            { duration: 5000, panelClass: ['aviso-toast', 'tone-warning'] },
          );
          this.router.navigate(['/referat', created.id]);
        },
      });
    });
  }

  private afterCreate(id: string): void {
    this.snack.open(
      'Referat trimis — a intrat pe traseul de avizare.',
      undefined,
      { duration: 4000, panelClass: ['aviso-toast', 'tone-success'] },
    );
    this.router.navigate(['/referat', id]);
  }

  // ---- File picker ----

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    if (picked.length === 0) return;
    // Append to the current selection, capped at 5 files total.
    this.selectedFiles.update((current) => [...current, ...picked].slice(0, 5));
    input.value = ''; // allow re-picking the same file
  }

  removeFile(index: number): void {
    this.selectedFiles.update((list) => list.filter((_, i) => i !== index));
  }
}
