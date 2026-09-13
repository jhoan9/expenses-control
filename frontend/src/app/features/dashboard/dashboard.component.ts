import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { formatCurrency } from '../../shared/utils/format';

const FALLBACK_COLORS = ['#0e9f6e', '#7c5cf2', '#0ea5e9', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#8b5cf6'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="page dashboard">
      <div class="dashboard-header">
        <div>
          <h2 class="dashboard-greeting">Hola, <span>{{ firstName }}</span> 👋</h2>
          <p class="page-subtitle">Este es el estado general de tus finanzas.</p>
        </div>
        <span class="dashboard-date">
          <app-icon name="calendar" />
          {{ todayLabel }}
        </span>
      </div>

      <div class="stats-grid" *ngIf="dashboard; else loading">
        <div class="stat-card featured">
          <app-icon class="stat-icon" name="wallet" />
          <span class="stat-label">Balance disponible</span>
          <span class="stat-value">{{ formatCurrency(dashboard.balance) }}</span>
          <span class="stat-sub">
            Luego de {{ formatCurrency(dashboard.third_party) }} de terceros
          </span>
        </div>

        <div class="stat-card">
          <app-icon class="stat-icon income" name="arrow-down-left" />
          <span class="stat-label">Ingresos del mes</span>
          <span class="stat-value">{{ formatCurrency(dashboard?.monthly?.income) }}</span>
          <span class="stat-sub">Hasta hoy</span>
        </div>

        <div class="stat-card">
          <app-icon class="stat-icon expense" name="receipt" />
          <span class="stat-label">Gastos del mes</span>
          <span class="stat-value">{{ formatCurrency(dashboard?.monthly?.expenses) }}</span>
          <span class="stat-sub">Hasta hoy</span>
        </div>

        <div class="stat-card">
          <app-icon class="stat-icon savings" name="coins" />
          <span class="stat-label">Neto del mes</span>
          <span class="stat-value" [class]="(dashboard?.monthly?.net ?? 0) >= 0 ? 'amount-positive' : 'amount-negative'">
            {{ formatCurrency(dashboard?.monthly?.net) }}
          </span>
          <span class="stat-trend" [class.up]="(dashboard?.monthly?.net ?? 0) >= 0" [class.down]="(dashboard?.monthly?.net ?? 0) < 0">
            {{ (dashboard?.monthly?.net ?? 0) >= 0 ? '+' : '' }}{{ formatCurrency(dashboard?.monthly?.net) }}
          </span>
        </div>

        <div class="stat-card">
          <app-icon class="stat-icon investment" name="trending-up" />
          <span class="stat-label">Inversiones</span>
          <span class="stat-value">{{ formatCurrency(dashboard?.investments) }}</span>
          <span class="stat-sub">Patrimonio asignado</span>
        </div>

        <div class="stat-card">
          <app-icon class="stat-icon" name="users" />
          <span class="stat-label">Dinero de terceros</span>
          <span class="stat-value">{{ formatCurrency(dashboard?.third_party) }}</span>
          <span class="stat-sub">No te pertenece</span>
        </div>

        <div class="stat-card">
          <app-icon class="stat-icon" name="exchange" />
          <span class="stat-label">Préstamos otorgados</span>
          <span class="stat-value">{{ formatCurrency(dashboard?.loans) }}</span>
          <span class="stat-sub">Por cobrar</span>
        </div>

        <div class="stat-card">
          <app-icon class="stat-icon" name="credit-card" />
          <span class="stat-label">Créditos pendientes</span>
          <span class="stat-value">{{ formatCurrency(dashboard?.credits) }}</span>
          <span class="stat-sub">Por pagar</span>
        </div>
      </div>

      <ng-template #loading>
        <div class="skeleton-grid">
          <div class="skeleton block" *ngFor="let i of [1, 2, 3, 4]"></div>
        </div>
      </ng-template>

      <div class="chart-grid" *ngIf="dashboard">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3>Gastos por categoría</h3>
            <span class="chart-sub">Movimientos recientes</span>
          </div>

          <div class="donut-wrap" *ngIf="segments && segments.length >= 2; else donutEmpty">
            <div class="donut" [style.background]="donutGradient">
              <div class="donut-center">
                <strong>{{ formatCurrency(donutTotal) }}</strong>
                <span>gastos recientes</span>
              </div>
            </div>
            <div class="donut-legend">
              <div class="legend-item" *ngFor="let seg of visibleSegments">
                <span class="legend-dot" [style.background]="seg.color"></span>
                <span class="legend-label">{{ seg.label }}</span>
                <span class="legend-value">{{ formatCurrency(seg.value) }}</span>
                <span class="legend-pct">{{ seg.pct }}%</span>
              </div>
              <div class="legend-item" *ngIf="hiddenCount > 0">
                <span class="legend-dot" style="background:#d7dce6"></span>
                <span class="legend-label">Otros ({{ hiddenCount }})</span>
              </div>
            </div>
          </div>

          <ng-template #donutEmpty>
            <div class="empty-state compact">
              <app-icon class="empty-icon" name="pie-chart" />
              <p class="empty-title">Datos insuficientes</p>
              <p class="empty-text">Suma al menos dos gastos para ver el desglose por categoría.</p>
            </div>
          </ng-template>
        </div>

        <div class="list-card">
          <div class="list-card-header">
            <h3>Actividad reciente</h3>
            <a class="card-link" routerLink="/expenses">Ver movimientos</a>
          </div>

          <div class="list" *ngIf="recentActivity.length; else activityEmpty">
            <div class="list-item" *ngFor="let m of recentActivity">
              <span class="item-icon" [class.income]="m.type === 'income'" [class.expense]="m.type === 'expense'">
                <app-icon [name]="m.type === 'income' ? 'arrow-down-left' : 'receipt'" />
              </span>
              <div class="item-info">
                <span class="item-description">{{ m.description || 'Sin descripción' }}</span>
                <small class="item-category" [style.color]="m.type === 'expense' ? m.color : undefined">
                  {{ m.category_name }}
                </small>
              </div>
              <span class="item-amount" [class.positive]="m.type === 'income'" [class.negative]="m.type === 'expense'">
                {{ m.type === 'income' ? '+' : '-' }}{{ formatCurrency(m.amount) }}
              </span>
            </div>
          </div>

          <ng-template #activityEmpty>
            <div class="empty-state compact">
              <app-icon class="empty-icon" name="inbox" />
              <p class="empty-title">Sin movimientos aún</p>
              <p class="empty-text">Registra ingresos y gastos para verlos aquí.</p>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  formatCurrency = formatCurrency;
  dashboard: any = null;

  constructor(private api: ApiService, public authService: AuthService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  get firstName(): string {
    const name = this.authService.currentUser?.name?.trim();
    return name ? name.split(/\s+/)[0] : '';
  }

  get todayLabel(): string {
    return new Date().toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  get segments(): { label: string; value: number; color: string; pct: number }[] {
    const expenses: any[] = this.dashboard?.recent_expenses ?? [];
    const grouped = new Map<string, { label: string; value: number; color: string }>();
    for (const e of expenses) {
      const label = e.category_name ?? 'Sin categoría';
      const existing = grouped.get(label);
      const amount = Number(e.amount) || 0;
      if (existing) {
        existing.value += amount;
      } else {
        grouped.set(label, { label, value: amount, color: e.category_color || FALLBACK_COLORS[grouped.size % FALLBACK_COLORS.length] });
      }
    }
    const total = [...grouped.values()].reduce((acc, s) => acc + s.value, 0);
    if (total <= 0) return [];
    return [...grouped.values()]
      .sort((a, b) => b.value - a.value)
      .map((s) => ({ ...s, pct: Math.round((s.value / total) * 100) }));
  }

  get donutTotal(): number {
    return [...(this.dashboard?.recent_expenses ?? [])].reduce(
      (acc: number, e: any) => acc + (Number(e.amount) || 0),
      0
    );
  }

  get donutGradient(): string {
    const segs = this.segments;
    if (!segs.length) return '#eef1f6';
    let acc = 0;
    const stops = segs.map((s) => {
      const from = acc;
      acc += (s.value / this.donutTotal) * 100;
      return `${s.color} ${from}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }

  get visibleSegments() {
    return this.segments.slice(0, 6);
  }

  get hiddenCount(): number {
    return Math.max(0, this.segments.length - 6);
  }

  get recentActivity(): { type: string; description: string; category_name: string; amount: number; color: string }[] {
    const items: any[] = [];
    for (const e of this.dashboard?.recent_expenses ?? []) {
      items.push({ type: 'expense', ...e, color: e.category_color });
    }
    for (const i of this.dashboard?.recent_income ?? []) {
      items.push({ type: 'income', ...i, color: i.category_color });
    }
    return items
      .sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime())
      .slice(0, 8);
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
}