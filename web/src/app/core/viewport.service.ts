import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { map } from 'rxjs';

/** The phone breakpoint — keep in sync with the `@media (max-width: 720px)` SCSS rules. */
const MOBILE_QUERY = '(max-width: 720px)';

/**
 * Viewport breakpoints as signals. `isMobile` drives the alternate mobile
 * markup (tables → stacked cards, hamburger drawer); pure-CSS cases just use
 * the media query directly.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly observer = inject(BreakpointObserver);

  readonly isMobile = toSignal(
    this.observer.observe(MOBILE_QUERY).pipe(map((s) => s.matches)),
    { initialValue: this.observer.isMatched(MOBILE_QUERY) },
  );
}
