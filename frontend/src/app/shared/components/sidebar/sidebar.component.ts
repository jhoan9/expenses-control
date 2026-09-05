import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  template: `
    <button class="menu-fab" (click)="toggleMenu()" [class.hidden]="isOpen">☰</button>
    <aside class="sidebar" [class.open]="isOpen">
      <div class="sidebar-header">
        <h2>Expenses Control</h2>
        <button class="menu-toggle" (click)="toggleMenu()">
          {{ isOpen ? '×' : '☰' }}
        </button>
      </div>

      <nav class="sidebar-nav" (click)="closeMenu()">
        <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
          <span class="icon">📊</span> Dashboard
        </a>
        <a routerLink="/accounts" routerLinkActive="active">
          <span class="icon">🏦</span> Cuentas
        </a>
        <a routerLink="/income" routerLinkActive="active">
          <span class="icon">💰</span> Ingresos
        </a>
        <a routerLink="/expenses" routerLinkActive="active">
          <span class="icon">💸</span> {{ expensesLabel }}
        </a>
        <a routerLink="/budget" routerLinkActive="active">
          <span class="icon">📅</span> Presupuesto
        </a>
        <a routerLink="/investments" routerLinkActive="active" *ngIf="canAccess('investments')">
          <span class="icon">📈</span> Inversiones
        </a>
        <a routerLink="/third-party" routerLinkActive="active" *ngIf="canAccess('third-party')">
          <span class="icon">👥</span> Terceros
        </a>
        <a routerLink="/loans" routerLinkActive="active" *ngIf="canAccess('loans')">
          <span class="icon">🤝</span> {{ loansLabel }}
        </a>
        <a routerLink="/credits" routerLinkActive="active">
          <span class="icon">💳</span> {{ creditsLabel }}
        </a>
        <a routerLink="/categories" routerLinkActive="active">
          <span class="icon">🏷️</span> Categorías
        </a>
        <a routerLink="/reports" routerLinkActive="active">
          <span class="icon">📋</span> Reportes
        </a>
      </nav>

      <div class="sidebar-footer">
        <div class="user-info" *ngIf="authService.currentUser as user">
          <span>{{ user.name }}</span>
          <small>{{ user.role }}</small>
        </div>
        <button class="logout-btn" (click)="logout()">Cerrar sesión</button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 260px;
      background: #1a1a2e;
      color: white;
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 100;
      transition: transform 0.3s ease;
    }
    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid #2a2a4a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .sidebar-header h2 {
      margin: 0;
      font-size: 1.2rem;
    }
    .menu-toggle {
      display: none;
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
    }
    .sidebar-nav {
      flex: 1;
      padding: 16px 0;
      overflow-y: auto;
    }
    .sidebar-nav a {
      display: flex;
      align-items: center;
      padding: 12px 20px;
      color: #b0b0b0;
      text-decoration: none;
      transition: all 0.2s;
    }
    .sidebar-nav a:hover {
      background: #2a2a4a;
      color: white;
    }
    .sidebar-nav a.active {
      background: #3a3a5a;
      color: white;
      border-left: 3px solid #4caf50;
    }
    .icon {
      margin-right: 12px;
      font-size: 1.1rem;
    }
    .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid #2a2a4a;
    }
    .user-info {
      margin-bottom: 12px;
    }
    .user-info span {
      display: block;
      font-weight: 500;
    }
    .user-info small {
      color: #888;
    }
    .logout-btn {
      width: 100%;
      padding: 8px;
      background: #e53935;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    .logout-btn:hover {
      background: #c62828;
    }
    .menu-fab {
      display: none;
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 101;
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 8px;
      background: #1a1a2e;
      color: white;
      font-size: 1.3rem;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    @media (max-width: 768px) {
      .menu-fab {
        display: block;
      }
      .menu-fab.hidden {
        display: none;
      }
    }
    @media (max-width: 768px) {
      .sidebar {
        transform: translateX(-100%);
      }
      .sidebar.open {
        transform: translateX(0);
      }
      .menu-toggle {
        display: block;
      }
    }
  `]
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
