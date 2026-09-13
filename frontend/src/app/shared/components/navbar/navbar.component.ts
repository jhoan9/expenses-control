import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

const TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  accounts: 'Cuentas',
  income: 'Ingresos',
  expenses: 'Gastos',
  budget: 'Presupuesto',
  investments: 'Inversiones',
  'third-party': 'Terceros',
  loans: 'Préstamos',
  credits: 'Créditos',
  categories: 'Categorías',
  reports: 'Reportes',
};

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, IconComponent],
  template: `
    <nav class="navbar">
      <button
        class="mobile-menu-btn"
        (click)="menuClick.emit()"
        [class.menu-hidden]="!showMenu"
        aria-label="Abrir menú"
      >
        <app-icon name="menu" />
      </button>
      <h1 class="navbar-title">{{ pageTitle }}</h1>
      <span class="navbar-date">
        <app-icon name="calendar" />
        {{ todayLabel }}
      </span>
    </nav>
  `,
})
export class NavbarComponent {
  @Input() showMenu = true;
  @Output() menuClick = new EventEmitter<void>();

  constructor(private router: Router, public authService: AuthService) {}

  get pageTitle(): string {
    const seg = this.router.url.split('?')[0].split('/').filter(Boolean)[0] ?? 'dashboard';
    return TITLES[seg] ?? 'Dashboard';
  }

  get todayLabel(): string {
    return new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}