import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Quiet outline pill (e.g. "Pas curent", "Traseu scurt/complet"). */
@Component({
  selector: 'app-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge"><ng-content></ng-content></span>`,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 3px 9px;
        border-radius: var(--radius-pill);
        font-size: var(--text-caption-size);
        font-weight: var(--weight-semibold);
        line-height: 1.3;
        color: var(--text-body);
        background: var(--surface-card);
        border: 1px solid var(--border-default);
        white-space: nowrap;
      }
    `,
  ],
})
export class BadgeComponent {}
