import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, IconComponent],
  template: `
    <div class="sidebar-backdrop" [class.show]="isOpen" (click)="closeMenu()"></div>

    <aside class="sidebar" [class.open]="isOpen">
      <div class="sidebar-header">
        <a class="brand" routerLink="/dashboard">
          <img class="brand-icon" src="assets/icono.png" alt="Controla" />
          <div class="brand-text">
            <span class="brand-name">Controla</span>
            <span class="brand-sub">Finanzas Personales</span>
          </div>
        </a>
        <button class="menu-toggle" (click)="toggleMenu()" aria-label="Cerrar menú">
          <app-icon name="x" />
        </button>
      </div>

      <nav class="sidebar-nav" (click)="closeMenu()">
        <div class="nav-section">
          <div class="nav-section-title">Resumen</div>
          <a class="nav-item" routerLink="/dashboard" routerLinkActive="active"
             [routerLinkActiveOptions]="{ exact: true }">
            <app-icon class="nav-icon" name="grid" />
            <span class="nav-text">Dashboard</span>
          </a>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Movimientos</div>
          <a class="nav-item" routerLink="/accounts" routerLinkActive="active">
            <app-icon class="nav-icon" name="bank" />
            <span class="nav-text">Cuentas</span>
          </a>
          <a class="nav-item" routerLink="/income" routerLinkActive="active">
            <app-icon class="nav-icon" name="arrow-down-left" />
            <span class="nav-text">Ingresos</span>
          </a>
          <a class="nav-item" routerLink="/expenses" routerLinkActive="active">
            <app-icon class="nav-icon" name="receipt" />
            <span class="nav-text">{{ expensesLabel }}</span>
          </a>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Planificación</div>
          <a class="nav-item" routerLink="/budget" routerLinkActive="active">
            <app-icon class="nav-icon" name="calendar" />
            <span class="nav-text">Presupuesto</span>
          </a>
        </div>

        <div class="nav-section" *ngIf="canAccess('investments') || canAccess('third-party')">
          <div class="nav-section-title">Crecimiento</div>
          <a class="nav-item" routerLink="/investments" routerLinkActive="active" *ngIf="canAccess('investments')">
            <app-icon class="nav-icon" name="trending-up" />
            <span class="nav-text">Inversiones</span>
          </a>
          <a class="nav-item" routerLink="/third-party" routerLinkActive="active" *ngIf="canAccess('third-party')">
            <app-icon class="nav-icon" name="users" />
            <span class="nav-text">Terceros</span>
          </a>
        </div>

        <div class="nav-section" *ngIf="canAccess('loans')">
          <div class="nav-section-title">Financiación</div>
          <a class="nav-item" routerLink="/loans" routerLinkActive="active">
            <app-icon class="nav-icon" name="exchange" />
            <span class="nav-text">{{ loansLabel }}</span>
          </a>
          <a class="nav-item" routerLink="/credits" routerLinkActive="active">
            <app-icon class="nav-icon" name="credit-card" />
            <span class="nav-text">{{ creditsLabel }}</span>
          </a>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Administración</div>
          <a class="nav-item" routerLink="/categories" routerLinkActive="active">
            <app-icon class="nav-icon" name="tags" />
            <span class="nav-text">Categorías</span>
          </a>
          <a class="nav-item" routerLink="/reports" routerLinkActive="active">
            <app-icon class="nav-icon" name="bar-chart" />
            <span class="nav-text">Reportes</span>
          </a>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info" *ngIf="authService.currentUser as user">
          <div class="user-avatar">{{ userInitial(user) }}</div>
          <div class="user-meta">
            <span class="user-name">{{ user.name }}</span>
            <small class="user-role">{{ user.role }}</small>
          </div>
        </div>
        <button class="logout-btn" (click)="logout()">
          <app-icon class="nav-icon" name="log-out" />
          <span>{{ roleLabel }}</span>
        </button>
      </div>
    </aside>
  `,
})
export class SidebarComponent {
  isOpen = false;

  constructor(public authService: AuthService) {}

  get expensesLabel(): string {
    return this.isRole('ji01') ? 'Egresos' : 'Gastos';
  }

  get creditsLabel(): string {
    return this.isRole('ji01') ? 'Activos' : 'Créditos';
  }

  get loansLabel(): string {
    return this.isRole('ji01') ? 'Pasivos' : 'Préstamos';
  }

  get roleLabel(): string {
    return this.isRole('ji01') ? 'Cerrar sesión' : 'Cerrar sesión';
  }

  userInitial(user: any): string {
    const name = user?.name?.trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
  }

  private isRole(role: string): boolean {
    return this.authService.currentUser?.role === role;
  }

  toggleMenu(): void {
    this.isOpen = !this.isOpen;
  }

  closeMenu(): void {
    this.isOpen = false;
  }

  canAccess(module: 'investments' | 'third-party' | 'loans'): boolean {
    const role = this.authService.currentUser?.role;
    if (module === 'loans') {
      return role === 'jh01' || role === 'admin' || role === 'ji01';
    }
    return role === 'jh01' || role === 'admin';
  }

  logout(): void {
    this.authService.logout();
  }
}