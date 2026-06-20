import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { Role, User } from './models';

/**
 * Faked-auth session. Holds the loaded users and the acting role; the acting
 * user is the seeded user holding that role. No tokens, no real auth — the
 * acting identity is sent to the API per request.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiService);

  private static readonly STORAGE_KEY = 'aviso.role';

  readonly users = signal<User[]>([]);
  readonly actingRole = signal<Role | null>(this.readStoredRole());

  /** Live inbox size for the acting role — drives the nav badge. */
  readonly inboxCount = signal(0);

  /** The seeded user that holds the acting role. */
  readonly currentUser = computed<User | null>(() => {
    const role = this.actingRole();
    if (!role) return null;
    return this.users().find((u) => u.role === role) ?? null;
  });

  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  private loaded = false;

  /** Load the user directory once (idempotent). */
  async ensureUsers(): Promise<User[]> {
    if (!this.loaded) {
      const users = await firstValueFrom(this.api.getUsers());
      this.users.set(users);
      this.loaded = true;
    }
    return this.users();
  }

  setRole(role: Role): void {
    this.actingRole.set(role);
    try {
      localStorage.setItem(SessionService.STORAGE_KEY, role);
    } catch {
      /* storage unavailable — demo still works in-memory */
    }
    this.refreshInboxCount();
  }

  logout(): void {
    this.actingRole.set(null);
    this.inboxCount.set(0);
    try {
      localStorage.removeItem(SessionService.STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Re-query the inbox size for the acting role. Call after any workflow action. */
  refreshInboxCount(): void {
    const role = this.actingRole();
    if (!role) {
      this.inboxCount.set(0);
      return;
    }
    this.api.getInbox(role).subscribe({
      next: (list) => this.inboxCount.set(list.length),
      error: () => this.inboxCount.set(0),
    });
  }

  private readStoredRole(): Role | null {
    try {
      return (localStorage.getItem(SessionService.STORAGE_KEY) as Role) || null;
    } catch {
      return null;
    }
  }

  /** Synthetic demo email for a user (no real emails in the seed). */
  emailFor(user: User): string {
    const slug = user.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '') // strip combining diacritics
      .replace(/[^a-z]+/g, '.')
      .replace(/(^\.|\.$)/g, '');
    return `${slug}@apatim.ro`;
  }
}
