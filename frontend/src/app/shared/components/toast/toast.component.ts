import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../../core/toast/toast.service';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <div class="toast-container">
      <div
        class="toast"
        *ngFor="let toast of toasts$ | async; trackBy: trackById"
        [class]="'toast-' + toast.type"
        role="status"
        (click)="remove(toast.id)"
      >
        <span class="toast-icon">
          <app-icon [name]="iconFor(toast.type)" />
        </span>
        <div class="toast-body">
          <strong class="toast-title">{{ toast.title }}</strong>
          <span class="toast-message">{{ toast.message }}</span>
        </div>
        <button class="toast-close" (click)="remove(toast.id); $event.stopPropagation()" aria-label="Cerrar">
          &times;
        </button>
      </div>
    </div>
  `,
})
export class ToastComponent {
  toasts$;

  constructor(private toastService: ToastService) {
    this.toasts$ = this.toastService.toasts$;
  }

  trackById(_index: number, toast: { id: number }): number {
    return toast.id;
  }

  iconFor(type: string): string {
    switch (type) {
      case 'success':
        return 'shield-check';
      case 'warning':
      case 'error':
        return 'alert-circle';
      default:
        return 'inbox';
    }
  }

  remove(id: number): void {
    this.toastService.remove(id);
  }
}