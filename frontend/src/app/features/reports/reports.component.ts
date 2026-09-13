import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { formatCurrency, todayLocal, formatDate as formatDateUtil } from '../../shared/utils/format';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="reports">
      <h1>Reportes</h1>

      <div class="tabs">
        <button class="tab" [class.active]="activeTab === 'dashboard'" (click)="switchTab('dashboard')">Dashboard</button>
        <button class="tab" [class.active]="activeTab === 'gastos'" (click)="switchTab('gastos')">Gastos</button>
        <button class="tab" [class.active]="activeTab === 'ingresos'" (click)="switchTab('ingresos')">Ingresos</button>
        <button class="tab" [class.active]="activeTab === 'inversiones'" (click)="switchTab('inversiones')">Inversiones</button>
        <button class="tab" [class.active]="activeTab === 'cuentas'" (click)="switchTab('cuentas')">Cuentas</button>
        <button class="tab" [class.active]="activeTab === 'presupuesto'" (click)="switchTab('presupuesto')">Presupuesto</button>
      </div>

      <!-- Dashboard -->
      <div *ngIf="activeTab === 'dashboard'">
        <div class="stats-grid">
          <div class="stat-card">
            <h3>Balance Total</h3>
            <p class="stat-value">{{ formatCurrency(dashboard?.totalBalance) }}</p>
          </div>
          <div class="stat-card income">
            <h3>Ingresos del Mes</h3>
            <p class="stat-value">{{ formatCurrency(dashboard?.monthlyIncome) }}</p>
          </div>
          <div class="stat-card expense">
            <h3>Gastos del Mes</h3>
            <p class="stat-value">{{ formatCurrency(dashboard?.monthlyExpenses) }}</p>
          </div>
          <div class="stat-card net" [class.positive]="dashboard?.netFlow >= 0" [class.negative]="dashboard?.netFlow < 0">
            <h3>Flujo Neto</h3>
            <p class="stat-value">{{ formatCurrency(dashboard?.netFlow) }}</p>
          </div>
        </div>

        <div class="report-section" *ngIf="dashboard?.balanceByType?.length">
          <h3>Desglose del Balance</h3>
          <div class="table-container">
            <table>
              <thead><tr><th>Tipo</th><th>Balance</th><th>Porcentaje</th></tr></thead>
              <tbody>
                <tr *ngFor="let b of dashboard.balanceByType">
                  <td>{{ getTypeLabel(b.type) }}</td>
                  <td class="amount">{{ formatCurrency(b.total) }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill account-fill" [style.width.%]="b.percentage"></div>
                      </div>
                      <span class="progress-text">{{ b.percentage }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="lists-grid">
          <div class="list-card">
            <h3>Gastos Recientes</h3>
            <div class="list" *ngIf="dashboard?.recentExpenses?.length; else noExpenses">
              <div class="list-item" *ngFor="let e of dashboard.recentExpenses">
                <div class="item-info">
                  <span class="item-description">{{ e.description || 'Sin descripción' }}</span>
                  <small class="item-category">{{ e.category_name }}</small>
                </div>
                <span class="item-amount negative">-{{ formatCurrency(e.amount) }}</span>
              </div>
            </div>
            <ng-template #noExpenses><p class="no-data">No hay gastos recientes</p></ng-template>
          </div>

          <div class="list-card">
            <h3>Ingresos Recientes</h3>
            <div class="list" *ngIf="dashboard?.recentIncome?.length; else noIncome">
              <div class="list-item" *ngFor="let i of dashboard.recentIncome">
                <div class="item-info">
                  <span class="item-description">{{ i.description || 'Sin descripción' }}</span>
                  <small class="item-category">{{ i.category_name }}</small>
                </div>
                <span class="item-amount positive">+{{ formatCurrency(i.amount) }}</span>
              </div>
            </div>
            <ng-template #noIncome><p class="no-data">No hay ingresos recientes</p></ng-template>
          </div>
        </div>
      </div>

      <!-- Gastos -->
      <div *ngIf="activeTab === 'gastos'">
        <div class="filters">
          <input type="date" [(ngModel)]="filters.date_from" (change)="loadExpensesReport()" />
          <input type="date" [(ngModel)]="filters.date_to" (change)="loadExpensesReport()" />
        </div>

        <div class="summary-bar">
          <span>Total Gastos:</span>
          <strong class="negative">{{ formatCurrency(expensesData?.total) }}</strong>
        </div>

        <div class="report-section" *ngIf="expensesData">
          <h3>Por Categoría</h3>
          <div class="table-container" *ngIf="expensesData.byCategory?.length; else noExpCat">
            <table>
              <thead><tr><th>Categoría</th><th>Total</th><th>Porcentaje</th></tr></thead>
              <tbody>
                <tr *ngFor="let c of expensesData.byCategory">
                  <td><span class="category-dot" [style.background]="c.color"></span>{{ c.category_name }}</td>
                  <td class="amount negative">{{ formatCurrency(c.total) }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill expense-fill" [style.width.%]="c.percentage"></div>
                      </div>
                      <span class="progress-text">{{ c.percentage }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ng-template #noExpCat><p class="no-data">No hay datos de categorías</p></ng-template>
        </div>

        <div class="report-section" *ngIf="expensesData?.byMonth?.length">
          <h3>Por Mes</h3>
          <div class="table-container">
            <table>
              <thead><tr><th>Mes</th><th>Total</th><th>Porcentaje</th></tr></thead>
              <tbody>
                <tr *ngFor="let m of expensesData.byMonth">
                  <td>{{ m.month }}</td>
                  <td class="amount negative">{{ formatCurrency(m.total) }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill expense-fill" [style.width.%]="getPercentage(m.total, expensesData.total)"></div>
                      </div>
                      <span class="progress-text">{{ getPercentage(m.total, expensesData.total) }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="report-section" *ngIf="expensesData?.byPaymentMethod?.length">
          <h3>Por Método de Pago</h3>
          <div class="table-container">
            <table>
              <thead><tr><th>Método</th><th>Total</th><th>Porcentaje</th></tr></thead>
              <tbody>
                <tr *ngFor="let pm of expensesData.byPaymentMethod">
                  <td>{{ pm.name }}</td>
                  <td class="amount negative">{{ formatCurrency(pm.total) }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill expense-fill" [style.width.%]="getPercentage(pm.total, expensesData.total)"></div>
                      </div>
                      <span class="progress-text">{{ getPercentage(pm.total, expensesData.total) }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Ingresos -->
      <div *ngIf="activeTab === 'ingresos'">
        <div class="filters">
          <input type="date" [(ngModel)]="filters.date_from" (change)="loadIncomeReport()" />
          <input type="date" [(ngModel)]="filters.date_to" (change)="loadIncomeReport()" />
        </div>

        <div class="summary-bar">
          <span>Total Ingresos:</span>
          <strong class="positive">{{ formatCurrency(incomeData?.total) }}</strong>
        </div>

        <div class="report-section" *ngIf="incomeData">
          <h3>Por Categoría</h3>
          <div class="table-container" *ngIf="incomeData.byCategory?.length; else noIncCat">
            <table>
              <thead><tr><th>Categoría</th><th>Total</th><th>Porcentaje</th></tr></thead>
              <tbody>
                <tr *ngFor="let c of incomeData.byCategory">
                  <td>{{ c.category_name }}</td>
                  <td class="amount positive">{{ formatCurrency(c.total) }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill income-fill" [style.width.%]="c.percentage"></div>
                      </div>
                      <span class="progress-text">{{ c.percentage }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <ng-template #noIncCat><p class="no-data">No hay datos de categorías</p></ng-template>
        </div>

        <div class="report-section" *ngIf="incomeData?.byMonth?.length">
          <h3>Por Mes</h3>
          <div class="table-container">
            <table>
              <thead><tr><th>Mes</th><th>Total</th><th>Porcentaje</th></tr></thead>
              <tbody>
                <tr *ngFor="let m of incomeData.byMonth">
                  <td>{{ m.month }}</td>
                  <td class="amount positive">{{ formatCurrency(m.total) }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill income-fill" [style.width.%]="getPercentage(m.total, incomeData.total)"></div>
                      </div>
                      <span class="progress-text">{{ getPercentage(m.total, incomeData.total) }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Inversiones -->
      <div *ngIf="activeTab === 'inversiones'">
        <div class="stats-grid" *ngIf="investmentsData">
          <div class="stat-card">
            <h3>Total Invertido (Abierto)</h3>
            <p class="stat-value">{{ formatCurrency(investmentsData.totalInvested) }}</p>
          </div>
          <div class="stat-card">
            <h3>Ganancia Realizada</h3>
            <p class="stat-value" [class.positive]="investmentsData.totalRealizedPnl >= 0" [class.negative]="investmentsData.totalRealizedPnl < 0">
              {{ formatCurrency(investmentsData.totalRealizedPnl) }}
            </p>
          </div>
          <div class="stat-card">
            <h3>Posiciones</h3>
            <p class="stat-value">{{ investmentsData.positions?.length }}</p>
          </div>
        </div>

        <div class="report-section" *ngIf="investmentsData?.positions?.length">
          <h3>Detalle por Inversión</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Ticker</th>
                  <th>Estado</th>
                  <th>Cant. Abierta</th>
                  <th>Costo</th>
                  <th>Precio Prom.</th>
                  <th>P&L Realizado</th>
                  <th>Operaciones</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let p of investmentsData.positions">
                  <td>{{ p.name }}</td>
                  <td><span class="ticker">{{ p.ticker || '-' }}</span></td>
                  <td><span class="status-badge" [class.status-open]="!p.is_closed" [class.status-closed]="p.is_closed">{{ p.is_closed ? 'Cerrada' : 'Abierta' }}</span></td>
                  <td>{{ p.open_quantity > 0 ? formatQuantity(p.open_quantity) : '-' }}</td>
                  <td class="amount">{{ formatCurrency(p.cost_basis) }}</td>
                  <td class="amount">{{ p.open_quantity > 0 ? formatCurrency(p.avg_cost) : '-' }}</td>
                  <td class="amount" [class.positive]="p.realized_pnl >= 0" [class.negative]="p.realized_pnl < 0">{{ formatCurrency(p.realized_pnl) }}</td>
                  <td>{{ p.total_operations }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="empty-state" *ngIf="investmentsData?.positions?.length === 0">
          <p>No hay inversiones registradas</p>
        </div>
      </div>

      <!-- Cuentas -->
      <div *ngIf="activeTab === 'cuentas'">
        <div class="stats-grid" *ngIf="accountsData">
          <div class="stat-card">
            <h3>Balance Total</h3>
            <p class="stat-value">{{ formatCurrency(accountsData.totalBalance) }}</p>
          </div>
        </div>

        <div class="report-section" *ngIf="accountsData?.accounts?.length; else noAccounts">
          <h3>Por Cuenta</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cuenta</th>
                  <th>Tipo</th>
                  <th>Balance</th>
                  <th>% del Total</th>
                  <th>Movimientos</th>
                  <th>Último Movimiento</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let a of accountsData.accounts">
                  <td>{{ a.name }}</td>
                  <td><span class="type-badge" [class]="'type-' + a.type">{{ getTypeLabel(a.type) }}</span></td>
                  <td class="amount">{{ formatCurrency(a.balance) }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill account-fill" [style.width.%]="a.percentage"></div>
                      </div>
                      <span class="progress-text">{{ a.percentage }}%</span>
                    </div>
                  </td>
                  <td>{{ a.movement_count }}</td>
                  <td class="last-mov">
                    <span *ngIf="a.last_movement_type" class="mov-type" [class.mov-income]="isIncomeType(a.last_movement_type)" [class.mov-expense]="isExpenseType(a.last_movement_type)">
                      {{ getMovLabel(a.last_movement_type) }}
                    </span>
                    <small *ngIf="a.last_movement_date">{{ formatDate(a.last_movement_date) }}</small>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <ng-template #noAccounts><p class="no-data">No hay cuentas registradas</p></ng-template>
      </div>

      <!-- Presupuesto -->
      <div *ngIf="activeTab === 'presupuesto'">
        <div class="stats-grid" *ngIf="budgetData">
          <div class="stat-card">
            <h3>Presupuesto Actual</h3>
            <p class="stat-value">{{ budgetData.budgetName || 'Sin presupuesto' }}</p>
          </div>
          <div class="stat-card income">
            <h3>Ingreso Total</h3>
            <p class="stat-value">{{ formatCurrency(budgetData.totalIncome) }}</p>
          </div>
          <div class="stat-card" [class.income]="budgetData.totalPaid <= budgetData.totalPlanned" [class.expense]="budgetData.totalPaid > budgetData.totalPlanned">
            <h3>Total Pagado</h3>
            <p class="stat-value">{{ formatCurrency(budgetData.totalPaid) }}</p>
          </div>
          <div class="stat-card expense">
            <h3>Total Pendiente</h3>
            <p class="stat-value">{{ formatCurrency(budgetData.totalPending) }}</p>
          </div>
        </div>

        <div class="report-section" *ngIf="budgetData?.items?.length; else noBudget">
          <h3>Detalle por Ítem</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Progreso</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let item of budgetData.items">
                  <td>{{ item.name }}</td>
                  <td class="amount">{{ formatCurrency(item.amount) }}</td>
                  <td><span class="status-badge" [class.status-open]="item.status === 'pending'" [class.status-closed]="item.status === 'completed'">{{ item.status === 'completed' ? 'Pagado' : 'Pendiente' }}</span></td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill" [class.income-fill]="item.status === 'completed'" [class.expense-fill]="item.status === 'pending'" [style.width.%]="item.status === 'completed' ? 100 : 0"></div>
                      </div>
                      <span class="progress-text">{{ item.status === 'completed' ? '100%' : '0%' }}</span>
                    </div>
                  </td>
                  <td>{{ item.due_date ? formatDate(item.due_date) : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <ng-template #noBudget><p class="no-data">No hay presupuestos registrados</p></ng-template>
      </div>
    </div>
  `
})
export class ReportsComponent implements OnInit {
  formatCurrency = formatCurrency;
  activeTab = 'dashboard';

  dashboard: any = null;
  expensesData: any = null;
  incomeData: any = null;
  investmentsData: any = null;
  accountsData: any = null;
  budgetData: any = null;

  filters = {
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_to: todayLocal(),
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  switchTab(tab: string): void {
    this.activeTab = tab;
    switch (tab) {
      case 'dashboard': this.loadDashboard(); break;
      case 'gastos': this.loadExpensesReport(); break;
      case 'ingresos': this.loadIncomeReport(); break;
      case 'inversiones': this.loadInvestmentsReport(); break;
      case 'cuentas': this.loadAccountsReport(); break;
      case 'presupuesto': this.loadBudgetReport(); break;
    }
  }

  loadDashboard(): void {
    this.api.get<any>('/reports/dashboard').subscribe({
      next: (res) => {
        const d = res.data;
        const totalBalance = Number(d.balance || 0);
        const balanceByType = Object.entries(d.balance_by_type || {}).map(([type, total]) => ({
          type,
          total: Number(total),
          percentage: totalBalance > 0 ? Math.round((Math.abs(Number(total)) / Math.abs(totalBalance)) * 100) : 0,
        }));
        this.dashboard = {
          totalBalance,
          monthlyIncome: Number(d.monthly?.income || 0),
          monthlyExpenses: Number(d.monthly?.expenses || 0),
          netFlow: Number(d.monthly?.net || 0),
          balanceByType,
          recentExpenses: d.recent_expenses || [],
          recentIncome: d.recent_income || [],
        };
      },
      error: (err) => console.error('Error loading dashboard report', err),
    });
  }

  loadExpensesReport(): void {
    this.api.get<any>('/reports/expenses', this.filters).subscribe({
      next: (res) => {
        const d = res.data;
        const total = Number(d.total || 0);
        this.expensesData = {
          total,
          byCategory: (d.by_category || []).map((c: any) => ({
            ...c,
            category_name: c.name,
            percentage: this.getPercentage(Number(c.total), total),
          })),
          byMonth: d.by_month || [],
          byPaymentMethod: d.by_payment_method || [],
        };
      },
      error: (err) => console.error('Error loading expenses report', err),
    });
  }

  loadIncomeReport(): void {
    this.api.get<any>('/reports/income', this.filters).subscribe({
      next: (res) => {
        const d = res.data;
        const total = Number(d.total || 0);
        this.incomeData = {
          total,
          byCategory: (d.by_category || []).map((c: any) => ({
            ...c,
            category_name: c.name,
            percentage: this.getPercentage(Number(c.total), total),
          })),
          byMonth: d.by_month || [],
        };
      },
      error: (err) => console.error('Error loading income report', err),
    });
  }

  loadInvestmentsReport(): void {
    this.api.get<any>('/reports/investments').subscribe({
      next: (res) => {
        const d = res.data;
        this.investmentsData = {
          totalInvested: Number(d.total_invested || 0),
          totalRealizedPnl: Number(d.total_realized_pnl || 0),
          positions: d.positions || [],
        };
      },
      error: (err) => console.error('Error loading investments report', err),
    });
  }

  loadAccountsReport(): void {
    this.api.get<any>('/reports/accounts').subscribe({
      next: (res) => {
        const d = res.data;
        const totalBalance = Number(d.total_balance || 0);
        this.accountsData = {
          totalBalance,
          accounts: (d.accounts || []).map((a: any) => ({
            ...a,
            percentage: totalBalance > 0 ? Math.round((Math.abs(Number(a.balance)) / Math.abs(totalBalance)) * 100) : 0,
          })),
        };
      },
      error: (err) => console.error('Error loading accounts report', err),
    });
  }

  loadBudgetReport(): void {
    this.api.get<any>('/reports/budget').subscribe({
      next: (res) => {
        const d = res.data;
        const summary = d.summary || {};
        const budget = d.budget;
        this.budgetData = {
          budgetName: budget?.name || null,
          totalIncome: Number(summary.total_income || 0),
          totalPlanned: Number(summary.total_planned || 0),
          totalPaid: Number(summary.total_paid || 0),
          totalPending: Number(summary.total_pending || 0),
          items: d.items || [],
        };
      },
      error: (err) => console.error('Error loading budget report', err),
    });
  }

  getPercentage(part: number, total: number): number {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      stock: 'Acción', bond: 'Bono', etf: 'ETF', crypto: 'Crypto', other: 'Otro',
      cash: 'Efectivo', savings: 'Ahorro', investment: 'Inversión', credit_card: 'Crédito',
    };
    return labels[type] || type;
  }

  getMovLabel(type: string): string {
    const labels: Record<string, string> = {
      income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia',
      investment_buy: 'Compra', investment_sell: 'Venta', credit_payment: 'Abono',
    };
    return labels[type] || type;
  }

  isIncomeType(type: string): boolean {
    return ['income', 'investment_sell', 'transfer'].includes(type);
  }

  isExpenseType(type: string): boolean {
    return ['expense', 'investment_buy', 'credit_payment'].includes(type);
  }

  formatQuantity(value: number): string {
    const num = Number(value);
    if (isNaN(num)) return '0';
    return num % 1 === 0 ? num.toLocaleString('es-CO') : num.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  }

  formatDate(date: string): string {
    return formatDateUtil(date);
  }

}
