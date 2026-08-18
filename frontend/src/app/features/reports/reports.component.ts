import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

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
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Total</th>
                  <th>Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let c of expensesData.byCategory">
                  <td>
                    <span class="category-dot" [style.background]="c.color"></span>
                    {{ c.category_name }}
                  </td>
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
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Total</th>
                  <th>Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let m of expensesData.byMonth">
                  <td>{{ m.month }}</td>
                  <td class="amount negative">{{ formatCurrency(m.total) }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill expense-fill" [style.width.%]="getMonthPercentage(m.total, expensesData.total)"></div>
                      </div>
                      <span class="progress-text">{{ getMonthPercentage(m.total, expensesData.total) }}%</span>
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
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Total</th>
                  <th>Porcentaje</th>
                </tr>
              </thead>
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
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Total</th>
                  <th>Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let m of incomeData.byMonth">
                  <td>{{ m.month }}</td>
                  <td class="amount positive">{{ formatCurrency(m.total) }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill income-fill" [style.width.%]="getMonthPercentage(m.total, incomeData.total)"></div>
                      </div>
                      <span class="progress-text">{{ getMonthPercentage(m.total, incomeData.total) }}%</span>
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
            <h3>Total Invertido</h3>
            <p class="stat-value">{{ formatCurrency(investmentsData.totalInvested) }}</p>
          </div>
          <div class="stat-card">
            <h3>Posiciones</h3>
            <p class="stat-value">{{ investmentsData.totalPositions }}</p>
          </div>
        </div>

        <div class="report-section" *ngIf="investmentsData?.byType?.length">
          <h3>Por Tipo</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Costo Total</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let t of investmentsData.byType">
                  <td><span class="type-badge" [class]="'type-' + t.type">{{ getTypeLabel(t.type) }}</span></td>
                  <td>{{ t.count }}</td>
                  <td class="amount">{{ formatCurrency(t.total_cost) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
                  <th>Balance</th>
                  <th>Porcentaje</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let a of accountsData.accounts">
                  <td>{{ a.name }}</td>
                  <td class="amount">{{ formatCurrency(a.balance) }}</td>
                  <td>
                    <div class="progress-row">
                      <div class="progress-bar">
                        <div class="progress-fill account-fill" [style.width.%]="a.percentage"></div>
                      </div>
                      <span class="progress-text">{{ a.percentage }}%</span>
                    </div>
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
            <h3>Presupuestos</h3>
            <p class="stat-value">{{ budgetData.totalBudgets }}</p>
          </div>
          <div class="stat-card income">
            <h3>Total Planificado</h3>
            <p class="stat-value">{{ formatCurrency(budgetData.totalPlanned) }}</p>
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

        <div class="report-section" *ngIf="budgetData?.byBudget?.length; else noBudget">
          <h3>Por Presupuesto</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Ingreso</th>
                  <th>Pagado</th>
                  <th>Pendiente</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let b of budgetData.byBudget">
                  <td>{{ b.name }}</td>
                  <td class="amount">{{ formatCurrency(b.total_income) }}</td>
                  <td class="amount positive">{{ formatCurrency(b.total_paid) }}</td>
                  <td class="amount negative">{{ formatCurrency(b.total_pending) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <ng-template #noBudget><p class="no-data">No hay presupuestos registrados</p></ng-template>
      </div>
    </div>
  `,
  styles: [`
    .reports { padding: 0; }
    h1 { margin: 0 0 24px 0; color: #333; }
    h3 { margin: 0 0 16px 0; color: #333; }

    .tabs {
      display: flex;
      gap: 0;
      margin-bottom: 24px;
      border-bottom: 2px solid #eee;
      overflow-x: auto;
    }
    .tab {
      background: none;
      border: none;
      padding: 12px 20px;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 500;
      color: #888;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .tab:hover { color: #333; }
    .tab.active {
      color: #4caf50;
      border-bottom-color: #4caf50;
    }

    .filters {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .filters input {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.95rem;
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
    .list-card h3 { margin: 0 0 16px 0; }
    .list-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .item-description { font-weight: 500; color: #333; }
    .item-category { display: block; color: #888; font-size: 0.85rem; }
    .item-amount { font-weight: 600; }
    .item-amount.positive { color: #4caf50; }
    .item-amount.negative { color: #e53935; }

    .summary-bar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
      font-size: 1.1rem;
      background: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .positive { color: #4caf50; }
    .negative { color: #e53935; }

    .report-section {
      margin-bottom: 24px;
    }

    .table-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      overflow-x: auto;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #f0f0f0;
    }
    th {
      background: #fafafa;
      font-weight: 600;
      color: #555;
      font-size: 0.85rem;
      text-transform: uppercase;
    }
    tr:hover { background: #f9f9f9; }
    .amount { font-weight: 600; }

    .category-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }

    .progress-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .progress-bar {
      flex: 1;
      height: 8px;
      background: #eee;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s;
    }
    .expense-fill { background: #e53935; }
    .income-fill { background: #4caf50; }
    .account-fill { background: #1976d2; }
    .progress-text {
      font-size: 0.85rem;
      font-weight: 600;
      color: #555;
      min-width: 45px;
      text-align: right;
    }

    .type-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .type-stock { background: #e3f2fd; color: #1565c0; }
    .type-bond { background: #f3e5f5; color: #7b1fa2; }
    .type-etf { background: #e8f5e9; color: #2e7d32; }
    .type-crypto { background: #fff3e0; color: #e65100; }
    .type-other { background: #f5f5f5; color: #616161; }

    .no-data {
      color: #888;
      text-align: center;
      padding: 40px 20px;
      background: white;
      border-radius: 8px;
    }
  `]
})
export class ReportsComponent implements OnInit {
  activeTab = 'dashboard';

  dashboard: any = null;
  expensesData: any = null;
  incomeData: any = null;
  investmentsData: any = null;
  accountsData: any = null;
  budgetData: any = null;

  filters = {
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
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
        this.dashboard = {
          totalBalance: Number(d.balance || 0),
          monthlyIncome: Number(d.monthly?.income || 0),
          monthlyExpenses: Number(d.monthly?.expenses || 0),
          netFlow: Number(d.monthly?.net || 0),
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
            percentage: this.getMonthPercentage(Number(c.total), total),
          })),
          byMonth: d.by_month || [],
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
            percentage: this.getMonthPercentage(Number(c.total), total),
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
        const positions = d.positions || [];
        const byTypeMap = new Map<string, { count: number; total_cost: number }>();
        for (const p of positions) {
          const cur = byTypeMap.get(p.type) || { count: 0, total_cost: 0 };
          cur.count += 1;
          cur.total_cost += Number(p.total_cost || 0);
          byTypeMap.set(p.type, cur);
        }
        this.investmentsData = {
          totalInvested: Number(d.total_invested || 0),
          totalPositions: positions.length,
          byType: Array.from(byTypeMap, ([type, v]) => ({ type, ...v })),
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
            percentage: totalBalance > 0 ? Math.round((Number(a.balance) / totalBalance) * 100) : 0,
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
          totalBudgets: budget ? 1 : 0,
          totalPlanned: Number(summary.total_planned || 0),
          totalPaid: Number(summary.total_paid || 0),
          totalPending: Number(summary.total_pending || 0),
          byBudget: budget ? [{
            name: budget.name,
            total_income: Number(budget.total_income || 0),
            total_paid: Number(summary.total_paid || 0),
            total_pending: Number(summary.total_pending || 0),
          }] : [],
        };
      },
      error: (err) => console.error('Error loading budget report', err),
    });
  }

  getMonthPercentage(monthTotal: number, grandTotal: number): number {
    if (!grandTotal) return 0;
    return Math.round((monthTotal / grandTotal) * 100);
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = { stock: 'Acción', bond: 'Bono', etf: 'ETF', crypto: 'Crypto', other: 'Otro' };
    return labels[type] || type;
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
