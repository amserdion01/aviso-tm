import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StatusKey, STATUS_KEY_LABEL } from '../core/models';

/** Status pill — one calm hue per workflow state (design StatusBadge). */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="status()" [class.sm]="size() === 'sm'">
      <span class="dot"></span>{{ label() }}
    </span>
  `,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: var(--radius-pill);
        font-size: var(--text-sm-size);
        font-weight: var(--weight-semibold);
        line-height: 1;
        border: 1px solid transparent;
        white-space: nowrap;
      }
      .badge.sm {
        padding: 3px 8px;
        font-size: var(--text-caption-size);
        gap: 5px;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex: none;
      }
      .pending {
        background: var(--status-pending-bg);
        border-color: var(--status-pending-border);
        color: var(--status-pending-text);
      }
      .pending .dot { background: var(--status-pending-solid); }
      .approved {
        background: var(--status-approved-bg);
        border-color: var(--status-approved-border);
        color: var(--status-approved-text);
      }
      .approved .dot { background: var(--status-approved-solid); }
      .rejected {
        background: var(--status-rejected-bg);
        border-color: var(--status-rejected-border);
        color: var(--status-rejected-text);
      }
      .rejected .dot { background: var(--status-rejected-solid); }
      .sentback {
        background: var(--status-sentback-bg);
        border-color: var(--status-sentback-border);
        color: var(--status-sentback-text);
      }
      .sentback .dot { background: var(--status-sentback-solid); }
      .finalized {
        background: var(--status-finalized-bg);
        border-color: var(--status-finalized-border);
        color: var(--status-finalized-text);
      }
      .finalized .dot { background: var(--status-finalized-solid); }
    `,
  ],
})
export class StatusBadgeComponent {
  readonly status = input.required<StatusKey>();
  readonly size = input<'sm' | 'md'>('md');
  readonly label = computed(() => STATUS_KEY_LABEL[this.status()]);
}
