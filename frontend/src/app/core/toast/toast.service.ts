import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title?: string;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly toastsSubject = new BehaviorSubject<Toast[]>([]);
  readonly toasts$ = this.toastsSubject.asObservable();
  private counter = 0;

  show(type: ToastType, message: string, title?: string, duration = 4000): void {
    const id = ++this.counter;
    this.toastsSubject.next([...this.toastsSubject.value, { id, type, message, title }]);

    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  showSuccess(message: string, title?: string, duration?: number): void {
    this.show('success', message, title, duration);
  }

  showError(message: string, title = 'Error', duration?: number): void {
    this.show('error', message, title, duration ?? 6000);
  }

  showWarning(message: string, title = 'Atención', duration?: number): void {
    this.show('warning', message, title, duration);
  }

  showInfo(message: string, title?: string, duration?: number): void {
    this.show('info', message, title, duration);
  }

  remove(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter((t) => t.id !== id));
  }

  clear(): void {
    this.toastsSubject.next([]);
  }
}