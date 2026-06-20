import {
  ChangeDetectionStrategy,
  Component,
  inject,
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
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api.service';
import { SessionService } from '../../core/session.service';
import { APPROVAL_THRESHOLD_LEI, CreateReferatPayload } from '../../core/models';
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
    IconComponent,
  ],
  templateUrl: './referat-nou.component.html',
  styleUrl: './referat-nou.component.scss',
})
export class ReferatNouComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);

  readonly threshold = APPROVAL_THRESHOLD_LEI;
  readonly centruOptions = CENTRU_OPTIONS;

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
  });

  /** Live value of the estimated amount, drives the routing-path banner. */
  private readonly valoare = toSignal(this.form.controls.valoareLei.valueChanges, {
    initialValue: this.form.controls.valoareLei.value,
  });

  /** 'short' (below threshold), 'full' (at/above threshold) or null (no value). */
  readonly path = (): 'short' | 'full' | null => {
    const v = this.valoare();
    if (v == null || v <= 0) return null;
    return v >= this.threshold ? 'full' : 'short';
  };

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const requester = this.session.currentUser();
    if (!requester) return;

    const raw = this.form.getRawValue();
    const payload: CreateReferatPayload = {
      articol: raw.articol.trim(),
      cantitate: Number(raw.cantitate),
      justificare: raw.justificare.trim(),
      centruCost: raw.centruCost,
      valoareLei: Number(raw.valoareLei),
      requesterId: requester.id,
    };

    this.api.create(payload).subscribe((created) => {
      this.snack.open(
        'Referat trimis — a intrat pe traseul de avizare.',
        undefined,
        { duration: 4000, panelClass: ['aviso-toast', 'tone-success'] },
      );
      this.router.navigate(['/referat', created.id]);
    });
  }

  saveDraft(): void {
    this.snack.open('Schiță salvată', undefined, {
      duration: 3000,
      panelClass: ['aviso-toast', 'tone-info'],
    });
  }
}
