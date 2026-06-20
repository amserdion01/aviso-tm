import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import { SessionService } from '../core/session.service';
import { ROLES, ROLE_LABEL, Role } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/avatar.component';

/** App shell: sticky top bar (brand + role switcher) + left nav + content. */
@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSelectModule,
    FormsModule,
    IconComponent,
    AvatarComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly roles = ROLES;
  readonly roleLabel = ROLE_LABEL;
  readonly orgName = 'Timișoara';

  readonly currentUser = this.session.currentUser;
  readonly role = this.session.actingRole;
  /** Shared, kept in sync by SessionService after every workflow action. */
  readonly inboxCount = this.session.inboxCount;
  readonly userName = computed(() => this.currentUser()?.name ?? 'Utilizator');
  readonly roleText = computed(() => {
    const r = this.role();
    return r ? ROLE_LABEL[r] : '';
  });

  ngOnInit(): void {
    // Initial fill + keep fresh after navigation (e.g. returning from detail).
    this.session.refreshInboxCount();
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.session.refreshInboxCount());
  }

  onRoleChange(role: Role): void {
    this.session.setRole(role);
    this.router.navigate(['/inbox']);
  }

  logout(): void {
    this.session.logout();
    this.router.navigate(['/login']);
  }
}
