import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

export type AuditType = 'created' | 'approved' | 'rejected' | 'sentback' | 'finalized';

export interface AuditEvent {
  type: AuditType;
  actor: string;
  role: string;
  action: string;
  time: string;
  comment?: string | null;
}

/** Read-only istoric timeline — one calm marker per workflow event. */
@Component({
  selector: 'app-audit-timeline',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="timeline">
      @for (e of events(); track $index; let last = $last) {
        <li class="event" [class]="e.type" [class.last]="last">
          <div class="rail">
            <span class="marker"><app-icon [name]="iconFor(e.type)" [size]="13" [strokeWidth]="2.25" /></span>
            @if (!last) { <span class="line"></span> }
          </div>
          <div class="content">
            <div class="head">
              <span class="actor">{{ e.actor }}</span>
              <span class="role">{{ e.role }}</span>
            </div>
            <div class="action">{{ e.action }}</div>
            @if (e.comment) {
              <div class="comment">{{ e.comment }}</div>
            }
            <div class="time mono">{{ e.time }}</div>
          </div>
        </li>
      }
    </ol>
  `,
  styles: [
    `
      .timeline {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .event {
        display: flex;
        gap: 14px;
      }
      .rail {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: none;
      }
      .marker {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--border-default);
        background: var(--surface-sunken);
        color: var(--text-muted);
        flex: none;
      }
      .line {
        flex: 1;
        width: 2px;
        background: var(--border-default);
        margin: 2px 0;
        min-height: 12px;
      }
      .content {
        padding-bottom: 20px;
        min-width: 0;
      }
      .event.last .content {
        padding-bottom: 0;
      }
      .head {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
      }
      .actor {
        font-size: var(--text-sm-size);
        font-weight: var(--weight-semibold);
        color: var(--text-strong);
      }
      .role {
        font-size: var(--text-caption-size);
        color: var(--text-muted);
      }
      .action {
        font-size: var(--text-sm-size);
        color: var(--text-body);
        margin-top: 1px;
      }
      .comment {
        margin-top: 6px;
        padding: 8px 11px;
        background: var(--surface-sunken);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-md);
        font-size: var(--text-sm-size);
        color: var(--text-body);
        line-height: 1.5;
      }
      .time {
        font-size: var(--text-caption-size);
        color: var(--text-subtle);
        margin-top: 6px;
      }

      /* Marker tints per event type */
      .approved .marker {
        background: var(--status-approved-bg);
        border-color: var(--status-approved-border);
        color: var(--status-approved-text);
      }
      .rejected .marker {
        background: var(--status-rejected-bg);
        border-color: var(--status-rejected-border);
        color: var(--status-rejected-text);
      }
      .sentback .marker {
        background: var(--status-sentback-bg);
        border-color: var(--status-sentback-border);
        color: var(--status-sentback-text);
      }
      .finalized .marker {
        background: var(--status-finalized-bg);
        border-color: var(--status-finalized-border);
        color: var(--status-finalized-text);
      }
      .created .marker {
        background: var(--accent-weak);
        border-color: var(--accent-weak-border);
        color: var(--accent-text);
      }
    `,
  ],
})
export class AuditTimelineComponent {
  readonly events = input.required<AuditEvent[]>();

  iconFor(type: AuditType): IconName {
    switch (type) {
      case 'approved':
        return 'check';
      case 'rejected':
        return 'x';
      case 'sentback':
        return 'corner-up-left';
      case 'finalized':
        return 'check';
      default:
        return 'file-plus';
    }
  }
}
