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

import { ROLE_LABEL, User } from '../../core/models';
import { SessionService } from '../../core/session.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';

/** Demo account, derived from a seeded user. */
interface DemoAccount {
  user: User;
  name: string;
  roleLabel: string;
  email: string;
}

const DEMO_PASSWORD = 'apatim2026';
const EMAIL_RE = /.+@.+\..+/;

interface LoginForm {
  email: FormControl<string>;
  password: FormControl<string>;
  remember: FormControl<boolean>;
}

/**
 * Autentificare — faked-auth login. Picking a role (via the demo accounts or by
 * typing a known email) sets the acting role on the session and enters the app.
 * Any non-empty password is accepted; this is a demo. A reactive form drives the
 * field validation so Material renders the inline errors.
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
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly loginError = signal('');
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
    // Clear the "account not found" banner as soon as the user edits anything.
    this.form.valueChanges.subscribe(() => {
      if (this.loginError()) this.loginError.set('');
    });
    void this.init();
  }

  private async init(): Promise<void> {
    const users = await this.session.ensureUsers();
    const accounts: DemoAccount[] = users.map((user) => ({
      user,
      name: user.name,
      roleLabel: ROLE_LABEL[user.role],
      email: this.session.emailFor(user),
    }));
    this.accounts.set(accounts);
    // No autologin: the form starts empty. The user picks a demo account (which
    // fills the credentials) or types a known email, then submits.
  }

  fillAccount(account: DemoAccount): void {
    this.form.patchValue({ email: account.email, password: DEMO_PASSWORD });
    this.form.markAsUntouched();
    this.loginError.set('');
  }

  doLogin(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const entered = this.form.controls.email.value.trim().toLowerCase();
    const account = this.accounts().find(
      (a) => a.email.toLowerCase() === entered,
    );
    if (!account) {
      this.loginError.set(
        'Cont inexistent. Încearcă unul dintre conturile demo de mai jos.',
      );
      return;
    }

    this.session.setRole(account.user.role);
    void this.router.navigate(['/inbox']);
  }
}
