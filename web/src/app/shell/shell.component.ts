import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { MatMenuModule } from '@angular/material/menu';
import { filter, forkJoin } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SessionService } from '../core/session.service';
import { ROLE_LABEL } from '../core/models';
import { IconComponent } from '../shared/icon.component';
import { AvatarComponent } from '../shared/avatar.component';

/** A bell notification: an item that needs the user's attention. */
interface Notification {
  id: string;
  title: string;
  sub: string;
}

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
  private readonly destroyRef = inject(DestroyRef);

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

  /** Items needing the user's attention — shown in the notifications menu. */
  readonly notifications = signal<Notification[]>([]);
  /** Bell badge count (approvals to make + own referate sent back to correct). */
  readonly notifCount = computed(() => this.notifications().length);

  /** Mobile off-canvas drawer state (the sidebar itself on ≤720px). */
  readonly drawerOpen = signal(false);

  ngOnInit(): void {
    // Initial fill + keep fresh after navigation (e.g. returning from detail);
    // navigating also closes the mobile drawer.
    this.refreshNotifications();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.refreshNotifications();
        this.drawerOpen.set(false);
      });
  }

  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  /**
   * Build the notification list: referate awaiting the user's approval PLUS the
   * user's OWN referate that were sent back to them (so a requester learns their
   * request needs correcting instead of being blind to it). Also keeps the
   * shared inbox badge in sync.
   */
  refreshNotifications(): void {
    forkJoin({
      inbox: this.api.getInbox(),
      mine: this.api.getMine(),
    }).subscribe({
      next: ({ inbox, mine }) => {
        this.session.inboxCount.set(inbox.length);
        const items: Notification[] = inbox.map((r) => ({
          id: r.id,
          title: r.articol,
          sub: `${r.requester?.name ?? ''} · așteaptă decizia ta`,
        }));
        for (const r of mine) {
          if (r.status === 'TRIMIS_INAPOI' && !items.some((i) => i.id === r.id)) {
            items.push({
              id: r.id,
              title: r.articol,
              sub: 'Trimis înapoi ție · corectează și retrimite',
            });
          }
        }
        this.notifications.set(items);
      },
      error: () => {
        this.notifications.set([]);
      },
    });
  }

  /** Kept for the bell's (menuOpened) trigger — refresh on open. */
  loadNotifications(): void {
    this.refreshNotifications();
  }

  openReferat(id: string): void {
    this.router.navigate(['/referat', id]);
  }

  logout(): void {
    this.session.logout();
    this.router.navigate(['/login']);
  }
}
