import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { User } from './models';

/**
 * Real-auth session. Holds the JWT (persisted to localStorage) and the current
 * user loaded from GET /auth/me. Identity comes exclusively from login — there
 * is no client-side role switching.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiService);

  private static readonly TOKEN_KEY = 'aviso.token';

  readonly token = signal<string | null>(this.readStoredToken());
  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.token() !== null);

  /** Live inbox size for the current user's role — drives the nav badge. */
  readonly inboxCount = signal(0);

  /** Email + password → token + profile. Throws (HTTP error) on bad credentials. */
  async login(email: string, parola: string): Promise<User> {
    const res = await firstValueFrom(this.api.login(email, parola));
    this.token.set(res.token);
    try {
      localStorage.setItem(SessionService.TOKEN_KEY, res.token);
    } catch {
      /* storage unavailable — session stays in-memory */
    }
    this.currentUser.set(res.user);
    this.refreshInboxCount();
    return res.user;
  }

  /**
   * Make sure the profile is loaded for an existing token (e.g. after a page
   * reload). Returns the user, or null (and logs out) if the token is invalid.
   */
  async ensureUser(): Promise<User | null> {
    if (!this.token()) return null;
    if (this.currentUser()) return this.currentUser();
    try {
      const user = await firstValueFrom(this.api.me());
      this.currentUser.set(user);
      this.refreshInboxCount();
      return user;
    } catch {
      this.logout();
      return null;
    }
  }

  logout(): void {
    this.token.set(null);
    this.currentUser.set(null);
    this.inboxCount.set(0);
    try {
      localStorage.removeItem(SessionService.TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Re-query the inbox size for the current user. Call after workflow actions. */
  refreshInboxCount(): void {
    if (!this.isAuthenticated()) {
      this.inboxCount.set(0);
      return;
    }
    this.api.getInbox().subscribe({
      next: (list) => this.inboxCount.set(list.length),
      error: () => this.inboxCount.set(0),
    });
  }

  private readStoredToken(): string | null {
    try {
      return localStorage.getItem(SessionService.TOKEN_KEY);
    } catch {
      return null;
    }
  }
}
