import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { FormsModule } from '@angular/forms';
import { filter } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { Referat, ROLES, ROLE_LABEL, Role } from '../core/models';
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
    MatMenuModule,
    FormsModule,
    IconComponent,
    AvatarComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  private readonly session = inject(SessionService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly roles = ROLES;
  readonly roleLabel = ROLE_LABEL;
  readonly orgName = 'Timișoara';

  readonly currentUser = this.session.currentUser;
  readonly role = this.session.actingRole;
  /** The admin ("Administrare flux") screen is scoped to the Director General. */
  readonly isAdmin = computed(() => this.role() === 'DIR_GENERAL');
  /** Shared, kept in sync by SessionService after every workflow action. */
  readonly inboxCount = this.session.inboxCount;
  readonly userName = computed(() => this.currentUser()?.name ?? 'Utilizator');
  readonly roleText = computed(() => {
    const r = this.role();
    return r ? ROLE_LABEL[r] : '';
  });

  /** Referate awaiting the acting role — shown in the notifications menu. */
  readonly notifications = signal<Referat[]>([]);

  ngOnInit(): void {
    // Initial fill + keep fresh after navigation (e.g. returning from detail).
    this.session.refreshInboxCount();
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.session.refreshInboxCount());
  }

  /** Load the acting role's pending referate when the bell menu opens. */
  loadNotifications(): void {
    const role = this.role();
    if (!role) {
      this.notifications.set([]);
      return;
    }
    this.api.getInbox(role).subscribe({
      next: (list) => this.notifications.set(list),
      error: () => this.notifications.set([]),
    });
  }

  openReferat(id: string): void {
    this.router.navigate(['/referat', id]);
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
