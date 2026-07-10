import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ApiService } from '../../core/api.service';
import { ROLE_LABEL, User } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';

/** Demo account row, from the public user roster. */
interface DemoAccount {
  user: User;
  name: string;
  roleLabel: string;
  email: string;
}

const EMAIL_RE = /.+@.+\..+/;

interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
  remember: FormControl<boolean>;
}

/**
 * Autentificare — REAL login: email + password against POST /auth/login (JWT).
 * The demo rows fill only the email; the password is typed by the user (the
 * demo password is documented in the README, never in code).
 */
@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    AvatarComponent,
    IconComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly loginError = signal('');
  readonly submitting = signal(false);
  readonly accounts = signal<DemoAccount[]>([]);

  readonly form = this.fb.group<LoginForm>({
    email: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(EMAIL_RE)],
    }),
    password: this.fb.control('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    remember: this.fb.control(true, { nonNullable: true }),
  });

  constructor() {
    // Clear the error banner as soon as the user edits anything.
    this.form.valueChanges.subscribe(() => {
      if (this.loginError()) this.loginError.set('');
    });
    // Load the public demo roster (emails shown pre-auth by design).
    this.api.getUsers().subscribe((users) => {
      this.accounts.set(
        users.map((user) => ({
          user,
          name: user.name,
          roleLabel: ROLE_LABEL[user.role],
          email: user.email,
        })),
      );
    });
  }

  /** Demo row click fills ONLY the email — the password is always typed. */
  fillAccount(account: DemoAccount): void {
    this.form.patchValue({ email: account.email });
    this.form.markAsUntouched();
    this.loginError.set('');
  }

  doLogin(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.session
      .login(email.trim(), password)
      .then(() => {
        this.submitting.set(false);
        void this.router.navigate(['/inbox']);
      })
      .catch(() => {
        this.submitting.set(false);
        this.loginError.set(
          'Email sau parolă incorecte. Parola demo este în README-ul proiectului.',
        );
      });
  }
}
