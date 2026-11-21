import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';
import { ThemeMode, ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="theme-toggle" [class.compact]="compact" role="radiogroup" aria-label="Tema de color">
      <button
        *ngFor="let opt of options"
        type="button"
        role="radio"
        class="theme-option"
        [class.active]="theme.mode() === opt.value"
        [attr.aria-checked]="theme.mode() === opt.value"
        [attr.aria-label]="opt.label"
        [title]="opt.label"
        (click)="theme.setMode(opt.value)"
      >
        <app-icon [name]="opt.icon" />
      </button>
    </div>
  `,
})
export class ThemeToggleComponent {
  @Input() compact = false;

  readonly options: { value: ThemeMode; icon: string; label: string }[] = [
    { value: 'light', icon: 'sun', label: 'Tema claro' },
    { value: 'dark', icon: 'moon', label: 'Tema oscuro' },
    { value: 'system', icon: 'monitor', label: 'Usar tema del sistema' },
  ];

  constructor(public theme: ThemeService) {}
}
