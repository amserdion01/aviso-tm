import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Circular initials avatar — calm blue tint, sized xs/sm/md. */
@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="avatar" [class]="size()">{{ initials() }}</span>`,
  styles: [
    `
      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: var(--accent-weak);
        color: var(--accent-text);
        font-weight: var(--weight-semibold);
        line-height: 1;
        flex: none;
        user-select: none;
      }
      .xs { width: 24px; height: 24px; font-size: 10px; }
      .sm { width: 32px; height: 32px; font-size: 12px; }
      .md { width: 40px; height: 40px; font-size: 14px; }
    `,
  ],
})
export class AvatarComponent {
  readonly name = input<string>('');
  readonly size = input<'xs' | 'sm' | 'md'>('sm');
  readonly initials = computed(() => {
    const parts = this.name().trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });
}
