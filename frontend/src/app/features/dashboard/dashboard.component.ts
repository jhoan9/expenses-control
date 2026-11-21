import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/components/icon/icon.component';
import { formatCurrency } from '../../shared/utils/format';

const FALLBACK_COLORS = ['#0d7a55', '#2f5bd3', '#b76e00', '#0e7490', '#c2382e', '#9d3b6b', '#5f7a12', '#6f7a73'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, IconComponent],
  template: `
    <div class="page dashboard">
      <header class="dashboard-header">
        <div>
          <h2 class="dashboard-greeting">{{ greeting }}<ng-container *ngIf="firstName">, {{ firstName }}</ng-container></h2>
          <p class="page-subtitle">Así van tus finanzas en {{ monthLabel }}.</p>
        </div>
        <div class="dashboard-actions">
          <a class="btn-secondary" routerLink="/income">
            <app-icon name="arrow-down-left" />
            Registrar ingreso
          </a>
          <a class="btn-primary" routerLink="/expenses">
            <app-icon name="plus" />
            Registrar gasto
          </a>
        </div>
      </header>

      <ng-container *ngIf="dashboard; else loading">
        <section class="kpi-grid" aria-label="Resumen del mes">
          <div class="stat-card featured">
            <span class="stat-label">Balance disponible</span>
            <span class="stat-value">{{ formatCurrency(dashboard.balance) }}</span>
            <span class="stat-sub">Después de {{ formatCurrency(dashboard.third_party) }} de terceros</span>
          </div>

          <div class="stat-card">
            <span class="stat-label"><i class="stat-dot income"></i>Ingresos del mes</span>
            <span class="stat-value">{{ formatCurrency(dashboard?.monthly?.income) }}</span>
            <span class="stat-sub">Hasta hoy</span>
          </div>

          <div class="stat-card">
            <span class="stat-label"><i class="stat-dot expense"></i>Gastos del mes</span>
            <span class="stat-value">{{ formatCurrency(dashboard?.monthly?.expenses) }}</span>
            <span class="stat-sub" *ngIf="spendRatio !== null">{{ spendRatio }}% de tus ingresos</span>
            <span class="stat-sub" *ngIf="spendRatio === null">Hasta hoy</span>
          </div>

          <div class="stat-card">
            <span class="stat-label"><i class="stat-dot net"></i>Neto del mes</span>
            <span class="stat-value" [class.amount-positive]="net >= 0" [class.amount-negative]="net < 0">
              {{ net > 0 ? '+' : '' }}{{ formatCurrency(net) }}
            </span>
            <span class="stat-sub">{{ net >= 0 ? 'Vas ahorrando este mes' : 'Gastas más de lo que entra' }}</span>
          </div>
        </section>

        <section class="wealth-strip" aria-label="Patrimonio y obligaciones">
          <div class="wealth-item">
            <span class="wealth-icon"><app-icon name="trending-up" /></span>
            <div>
              <span class="wealth-label">Inversiones</span>
              <span class="wealth-value">{{ formatCurrency(dashboard?.investments) }}</span>
            </div>
          </div>
          <div class="wealth-item">
            <span class="wealth-icon"><app-icon name="users" /></span>
            <div>
              <span class="wealth-label">Dinero de terceros</span>
              <span class="wealth-value">{{ formatCurrency(dashboard?.third_party) }}</span>
            </div>
          </div>
          <div class="wealth-item">
            <span class="wealth-icon"><app-icon name="exchange" /></span>
            <div>
              <span class="wealth-label">Préstamos por cobrar</span>
              <span class="wealth-value">{{ formatCurrency(dashboard?.loans) }}</span>
            </div>
          </div>
          <div class="wealth-item">
            <span class="wealth-icon"><app-icon name="credit-card" /></span>
            <div>
              <span class="wealth-label">Créditos por pagar</span>
              <span class="wealth-value">{{ formatCurrency(dashboard?.credits) }}</span>
            </div>
          </div>
        </section>

        <div class="chart-grid">
          <section class="chart-card">
            <div class="chart-card-header">
              <h3>Gastos por categoría</h3>
              <a class="card-link" routerLink="/reports">Ver reporte</a>
            </div>

            <ng-container *ngIf="segments.length >= 2; else donutEmpty">
              <div class="breakdown-total">
                <strong>{{ formatCurrency(donutTotal) }}</strong>
                <span>en {{ segments.length }} categorías, movimientos recientes</span>
              </div>
              <div class="breakdown-bar" role="img" [attr.aria-label]="breakdownLabel">
                <span
                  *ngFor="let seg of segments"
                  [style.flex-grow]="seg.value"
                  [style.background]="seg.color"
                  [title]="seg.label + ' ' + seg.pct + '%'"
                ></span>
              </div>
              <ul class="breakdown-legend">
                <li class="legend-item" *ngFor="let seg of visibleSegments">
                  <span class="legend-dot" [style.background]="seg.color"></span>
                  <span class="legend-label">{{ seg.label }}</span>
                  <span class="legend-value">{{ formatCurrency(seg.value) }}</span>
                  <span class="legend-pct">{{ seg.pct }}%</span>
                </li>
                <li class="legend-item" *ngIf="hiddenCount > 0">
                  <span class="legend-dot" style="background: var(--border-strong)"></span>
                  <span class="legend-label">Otras {{ hiddenCount }} categorías</span>
                </li>
              </ul>
            </ng-container>

            <ng-template #donutEmpty>
              <div class="empty-state compact">
                <app-icon class="empty-icon" name="pie-chart" />
                <p class="empty-title">Datos insuficientes</p>
                <p class="empty-text">Registra gastos en al menos dos categorías para ver el desglose.</p>
              </div>
            </ng-template>
          </section>

          <section class="list-card">
            <div class="list-card-header">
              <h3>Actividad reciente</h3>
              <a class="card-link" routerLink="/expenses">Ver movimientos</a>
            </div>

            <ul class="list" *ngIf="recentActivity.length; else activityEmpty">
              <li class="list-item" *ngFor="let m of recentActivity">
                <span class="item-icon" [class.income]="m.type === 'income'" [class.expense]="m.type === 'expense'">
                  <app-icon [name]="m.type === 'income' ? 'arrow-down-left' : 'receipt'" />
                </span>
                <div class="item-info">
                  <span class="item-description">{{ m.description || 'Sin descripción' }}</span>
                  <small class="item-category">
                    <i class="category-swatch" *ngIf="m.color" [style.background]="m.color"></i>
                    {{ m.category_name || 'Sin categoría' }}<ng-container *ngIf="m.date"> · {{ shortDate(m.date) }}</ng-container>
                  </small>
                </div>
                <span class="item-amount" [class.positive]="m.type === 'income'">
                  {{ m.type === 'income' ? '+' : '−' }}{{ formatCurrency(m.amount) }}
                </span>
              </li>
            </ul>

            <ng-template #activityEmpty>
              <div class="empty-state compact">
                <app-icon class="empty-icon" name="inbox" />
                <p class="empty-title">Sin movimientos aún</p>
                <p class="empty-text">Registra ingresos y gastos para verlos aquí.</p>
              </div>
            </ng-template>
          </section>
        </div>
      </ng-container>

      <ng-template #loading>
        <div class="kpi-grid">
          <div class="skeleton block" *ngFor="let i of [1, 2, 3, 4]"></div>
        </div>
      </ng-template>
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

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 19) return 'Buenas tardes';
    return 'Buenas noches';
  }

  get monthLabel(): string {
    return new Date().toLocaleDateString('es-ES', { month: 'long' });
  }

  get net(): number {
    return Number(this.dashboard?.monthly?.net ?? 0);
  }

  get spendRatio(): number | null {
    const income = Number(this.dashboard?.monthly?.income ?? 0);
    const expenses = Number(this.dashboard?.monthly?.expenses ?? 0);
    if (income <= 0) return null;
    return Math.round((expenses / income) * 100);
  }

  get breakdownLabel(): string {
    return this.segments.map((s) => `${s.label} ${s.pct}%`).join(', ');
  }

  shortDate(value: string): string {
    const d = new Date(value.length === 10 ? value + 'T12:00:00' : value);
    if (isNaN(d.getTime())) return '';
    const today = new Date();
    const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Ayer';
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
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

  get visibleSegments() {
    return this.segments.slice(0, 6);
  }

  get hiddenCount(): number {
    return Math.max(0, this.segments.length - 6);
  }

  get recentActivity(): { type: string; description: string; category_name: string; amount: number; color: string; date?: string }[] {
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