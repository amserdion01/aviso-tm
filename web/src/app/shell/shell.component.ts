import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { filter } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { Referat, ROLE_LABEL } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/avatar.component';

/**
 * App shell: sticky top bar (brand + notifications + logout) + left nav +
 * content. Identity comes exclusively from the JWT session — switching roles
 * means logging out and in with another account.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatMenuModule,
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

  readonly orgName = 'Timișoara';

  readonly currentUser = this.session.currentUser;
  /** The admin ("Administrare flux") screen is scoped to the Director General. */
  readonly isAdmin = computed(() => this.currentUser()?.role === 'DIR_GENERAL');
  /** Shared, kept in sync by SessionService after every workflow action. */
  readonly inboxCount = this.session.inboxCount;
  readonly userName = computed(() => this.currentUser()?.name ?? 'Utilizator');
  readonly roleText = computed(() => {
    const user = this.currentUser();
    return user ? ROLE_LABEL[user.role] : '';
  });

  /** Referate awaiting the current user — shown in the notifications menu. */
  readonly notifications = signal<Referat[]>([]);

  /** Mobile off-canvas drawer state (the sidebar itself on ≤720px). */
  readonly drawerOpen = signal(false);

  ngOnInit(): void {
    // Initial fill + keep fresh after navigation (e.g. returning from detail);
    // navigating also closes the mobile drawer.
    this.session.refreshInboxCount();
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.session.refreshInboxCount();
        this.drawerOpen.set(false);
      });
  }

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  /** Load the current user's pending referate when the bell menu opens. */
  loadNotifications(): void {
    this.api.getInbox().subscribe({
      next: (list) => this.notifications.set(list),
      error: () => this.notifications.set([]),
    });
  }

  openReferat(id: string): void {
    this.router.navigate(['/referat', id]);
  }

  logout(): void {
    this.session.logout();
    this.router.navigate(['/login']);
  }
}
