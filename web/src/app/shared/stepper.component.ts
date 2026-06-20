import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

export type StepStatus = 'done' | 'current' | 'pending' | 'rejected' | 'sentback';

export interface StepperStep {
  label: string;
  sublabel?: string;
  status: StepStatus;
}

/** Horizontal approval-chain stepper with per-step markers and connectors. */
@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="stepper">
      @for (step of steps(); track $index; let i = $index; let last = $last) {
        <li class="step" [class]="step.status">
          <div class="marker-row">
            <span class="marker">
              @switch (step.status) {
                @case ('done') { <app-icon name="check" [size]="14" [strokeWidth]="2.5" /> }
                @case ('rejected') { <app-icon name="x" [size]="14" [strokeWidth]="2.5" /> }
                @case ('sentback') { <app-icon name="corner-up-left" [size]="13" [strokeWidth]="2.5" /> }
                @default { <span class="num">{{ i + 1 }}</span> }
              }
            </span>
            @if (!last) { <span class="connector"></span> }
          </div>
          <div class="labels">
            <div class="label">{{ step.label }}</div>
            @if (step.sublabel) { <div class="sublabel">{{ step.sublabel }}</div> }
          </div>
        </li>
      }
    </ol>
  `,
  styles: [
    `
      .stepper {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        align-items: flex-start;
      }
      .step {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .step:last-child {
        flex: none;
      }
      .marker-row {
        display: flex;
        align-items: center;
        width: 100%;
      }
      .marker {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        flex: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--border-strong);
        background: var(--surface-card);
        color: var(--text-muted);
        font-size: var(--text-caption-size);
        font-weight: var(--weight-semibold);
      }
      .connector {
        flex: 1;
        height: 2px;
        margin: 0 8px;
        background: var(--border-default);
      }
      .labels {
        padding-right: 12px;
      }
      .label {
        font-size: var(--text-sm-size);
        font-weight: var(--weight-semibold);
        color: var(--text-strong);
      }
      .sublabel {
        font-size: var(--text-caption-size);
        color: var(--text-muted);
        margin-top: 1px;
      }

      /* States */
      .done .marker {
        background: var(--status-approved-solid);
        border-color: var(--status-approved-solid);
        color: #fff;
      }
      .done .connector {
        background: var(--status-approved-solid);
      }
      .current .marker {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--text-on-accent);
        box-shadow: var(--focus-ring);
      }
      .rejected .marker {
        background: var(--status-rejected-solid);
        border-color: var(--status-rejected-solid);
        color: #fff;
      }
      .sentback .marker {
        background: var(--status-sentback-solid);
        border-color: var(--status-sentback-solid);
        color: #fff;
      }
      .pending .marker {
        background: var(--surface-card);
        border-color: var(--border-strong);
        color: var(--text-subtle);
      }
    `,
  ],
})
export class StepperComponent {
  readonly steps = input.required<StepperStep[]>();
}
