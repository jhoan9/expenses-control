import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <h1>Dashboard</h1>

      <div class="stats-grid">
        <div class="stat-card">
          <h3>Balance Total</h3>
          <p class="stat-value">{{ formatCurrency(dashboard?.balance) }}</p>
        </div>

        <div class="stat-card income">
          <h3>Ingresos del Mes</h3>
          <p class="stat-value">{{ formatCurrency(dashboard?.monthly?.income) }}</p>
        </div>

        <div class="stat-card expense">
          <h3>Gastos del Mes</h3>
          <p class="stat-value">{{ formatCurrency(dashboard?.monthly?.expenses) }}</p>
        </div>

        <div class="stat-card net" [class.positive]="dashboard?.monthly?.net >= 0" [class.negative]="dashboard?.monthly?.net < 0">
          <h3>Neto del Mes</h3>
          <p class="stat-value">{{ formatCurrency(dashboard?.monthly?.net) }}</p>
        </div>

        <div class="stat-card">
          <h3>Dinero de Terceros</h3>
          <p class="stat-value">{{ formatCurrency(dashboard?.third_party) }}</p>
        </div>

        <div class="stat-card">
          <h3>Inversiones</h3>
          <p class="stat-value">{{ formatCurrency(dashboard?.investments) }}</p>
        </div>

        <div class="stat-card">
          <h3>Préstamos Otorgados</h3>
          <p class="stat-value">{{ formatCurrency(dashboard?.loans) }}</p>
        </div>

        <div class="stat-card">
          <h3>Créditos Pendientes</h3>
          <p class="stat-value">{{ formatCurrency(dashboard?.credits) }}</p>
        </div>
      </div>

      <div class="lists-grid">
        <div class="list-card">
          <h3>Gastos Recientes</h3>
          <div class="list" *ngIf="dashboard?.recent_expenses?.length; else noExpenses">
            <div class="list-item" *ngFor="let expense of dashboard?.recent_expenses">
              <div class="item-info">
                <span class="item-description">{{ expense.description || 'Sin descripción' }}</span>
                <small class="item-category" [style.color]="expense.category_color">{{ expense.category_name }}</small>
              </div>
              <span class="item-amount negative">-{{ formatCurrency(expense.amount) }}</span>
            </div>
          </div>
          <ng-template #noExpenses>
            <p class="no-data">No hay gastos recientes</p>
          </ng-template>
        </div>

        <div class="list-card">
          <h3>Ingresos Recientes</h3>
          <div class="list" *ngIf="dashboard?.recent_income?.length; else noIncome">
            <div class="list-item" *ngFor="let income of dashboard?.recent_income">
              <div class="item-info">
                <span class="item-description">{{ income.description || 'Sin descripción' }}</span>
                <small class="item-category">{{ income.category_name }}</small>
              </div>
              <span class="item-amount positive">+{{ formatCurrency(income.amount) }}</span>
            </div>
          </div>
          <ng-template #noIncome>
            <p class="no-data">No hay ingresos recientes</p>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard {
      padding: 0;
    }
    h1 {
      margin: 0 0 24px 0;
      color: #333;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .stat-card h3 {
      margin: 0 0 8px 0;
      font-size: 0.9rem;
      color: #666;
    }
    .stat-value {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #333;
    }
    .stat-card.income .stat-value { color: #4caf50; }
    .stat-card.expense .stat-value { color: #e53935; }
    .stat-card.net.positive .stat-value { color: #4caf50; }
    .stat-card.net.negative .stat-value { color: #e53935; }
    .lists-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 16px;
    }
    .list-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .list-card h3 {
      margin: 0 0 16px 0;
      color: #333;
    }
    .list-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .item-description {
      font-weight: 500;
      color: #333;
    }
    .item-category {
      display: block;
      color: #888;
      font-size: 0.85rem;
    }
    .item-amount {
      font-weight: 600;
    }
    .item-amount.positive { color: #4caf50; }
    .item-amount.negative { color: #e53935; }
    .no-data {
      color: #888;
      text-align: center;
      padding: 20px;
    }
  `]
})
export class DashboardComponent implements OnInit {
  dashboard: any = null;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.api.get<any>('/reports/dashboard').subscribe({
      next: (response) => {
        this.dashboard = response.data;
      },
      error: (err) => {
        console.error('Error loading dashboard', err);
      },
    });
  }

  formatCurrency(value: number): string {
    if (value === undefined || value === null) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
    }).format(value);
  }
}
