import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent, IconName } from './icon.component';

/** Reassuring empty state — icon, title, description, optional projected action. */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty">
      <div class="ic"><app-icon [name]="icon()" [size]="26" [strokeWidth]="1.75" /></div>
      <div class="title">{{ title() }}</div>
      <p class="desc">{{ description() }}</p>
      <div class="actions"><ng-content></ng-content></div>
    </div>
  `,
  styles: [
    `
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 48px 24px;
        gap: 6px;
      }
      .ic {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 52px;
        height: 52px;
        border-radius: var(--radius-xl);
        background: var(--surface-sunken);
        color: var(--text-muted);
        margin-bottom: 8px;
      }
      .title {
        font-size: var(--text-h3-size);
        font-weight: var(--weight-semibold);
        color: var(--text-strong);
      }
      .desc {
        font-size: var(--text-sm-size);
        color: var(--text-muted);
        line-height: 1.55;
        max-width: 420px;
        margin: 0;
      }
      .actions:not(:empty) {
        margin-top: 14px;
      }
    `,
  ],
})
export class EmptyStateComponent {
  readonly icon = input<IconName>('inbox');
  readonly title = input.required<string>();
  readonly description = input<string>('');
}
