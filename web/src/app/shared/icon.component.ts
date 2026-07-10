import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Inline Lucide-style line icon (1.5–2px stroke), rendered as SVG paths from a
 * small registry. Capture-proof and dependency-free, matching the design's
 * approach. Add new glyphs to ICONS as needed.
 */
export type IconName =
  | 'inbox'
  | 'file-plus'
  | 'list'
  | 'check'
  | 'x'
  | 'corner-up-left'
  | 'send'
  | 'bell'
  | 'arrow-left'
  | 'mail'
  | 'lock'
  | 'log-in'
  | 'log-out'
  | 'route'
  | 'users'
  | 'history'
  | 'chevron-down'
  | 'plus'
  | 'sliders'
  | 'trash'
  | 'arrow-up'
  | 'arrow-down'
  | 'paperclip'
  | 'download'
  | 'menu';

const ICONS: Record<IconName, string[]> = {
  inbox: [
    'M22 12h-6l-2 3h-4l-2-3H2',
    'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  ],
  'file-plus': ['M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z', 'M14 2v5h5', 'M12 18v-6', 'M9 15h6'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'M6 6l12 12'],
  'corner-up-left': ['M9 14 4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-1'],
  send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  'arrow-left': ['M19 12H5', 'm12 19-7-7 7-7'],
  mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'm22 7-10 6L2 7'],
  lock: ['M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z', 'M8 11V7a4 4 0 0 1 8 0v4'],
  'log-in': ['M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4', 'm10 17 5-5-5-5', 'M15 12H3'],
  'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  route: ['M5 12h14', 'm12 5 7 7-7 7'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  history: ['M3 3v5h5', 'M3.05 13a9 9 0 1 0 2.13-5.36L3 8', 'M12 7v5l4 2'],
  'chevron-down': ['m6 9 6 6 6-6'],
  plus: ['M5 12h14', 'M12 5v14'],
  sliders: [
    'M4 21v-7',
    'M4 10V3',
    'M12 21v-9',
    'M12 8V3',
    'M20 21v-5',
    'M20 12V3',
    'M1 14h6',
    'M9 8h6',
    'M17 16h6',
  ],
  trash: ['M3 6h18', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2', 'M10 11v6', 'M14 11v6'],
  'arrow-up': ['M12 19V5', 'm5 12 7-7 7 7'],
  'arrow-down': ['M12 5v14', 'm19 12-7 7-7-7'],
  paperclip: [
    'm21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48',
  ],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
};

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Atomic inline-flex box: keeps the (block) SVG from breaking onto its own
  // line when the icon sits inline next to text (e.g. inside a button label).
  styles: [':host { display: inline-flex; align-items: center; flex: none; }'],
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      style="display:block;flex:none"
      aria-hidden="true"
    >
      @for (d of paths(); track $index) {
        <path [attr.d]="d"></path>
      }
    </svg>
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<number>(18);
  readonly strokeWidth = input<number>(2);
  readonly paths = computed(() => ICONS[this.name()] ?? []);
}
