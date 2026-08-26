import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { formatCurrency } from '../../shared/utils/format';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyInputComponent],
  template: `
    <div class="page">
      <!-- LIST VIEW -->
      <ng-container *ngIf="!selectedBudget">
        <div class="page-header">
          <h1>Presupuesto</h1>
          <button class="btn-primary" (click)="openBudgetModal()">+ Nuevo Presupuesto</button>
        </div>

        <div class="cards-grid">
          <div class="card" *ngFor="let b of budgets" (click)="selectBudget(b)">
            <div class="card-header">
              <span class="period-badge" [class.first]="b.period_type === 'first'" [class.second]="b.period_type === 'second'">
                {{ b.period_type === 'first' ? '1ra Quincena' : '2da Quincena' }}
              </span>
              <div class="card-actions">
                <button class="btn-icon" (click)="editBudget(b, $event)" title="Editar">✏️</button>
                <button class="btn-icon" (click)="deleteBudget(b.id, $event)" title="Eliminar">🗑️</button>
              </div>
            </div>
            <div class="card-body">
              <p class="card-dates">{{ b.start_date }} — {{ b.end_date }}</p>
              <p class="card-amount">{{ formatCurrency(b.total_income) }}</p>
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="budgets.length === 0 && !loading">
          <p>No hay presupuestos registrados</p>
        </div>
      </ng-container>

      <!-- DETAIL VIEW -->
      <ng-container *ngIf="selectedBudget">
        <div class="page-header">
          <div class="header-left">
            <button class="btn-back" (click)="backToList()">← Volver</button>
            <h1>{{ selectedBudget.period_type === 'first' ? '1ra Quincena' : '2da Quincena' }}</h1>
          </div>
          <div class="header-actions">
            <button class="btn-copy" (click)="copyNext()" title="Crear la siguiente quincena con los gastos activos">⏭ Siguiente Quincena</button>
            <button class="btn-primary" (click)="saveDraft()" [disabled]="saving">
              {{ saving ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>

        <p class="detail-dates">{{ selectedBudget.start_date }} — {{ selectedBudget.end_date }}</p>

        <!-- Total Income -->
        <div class="income-box">
          <div class="form-group income-input">
            <label for="total_income">Ingreso de la Quincena</label>
            <app-currency-input id="total_income" [(ngModel)]="totalIncome" placeholder="0" />
          </div>
          <div class="income-summary">
            <div class="summary-item">
              <span class="summary-label">Asignado</span>
              <span class="summary-value warning">{{ formatCurrency(assignedTotal) }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Libre</span>
              <span class="summary-value" [class.positive]="freeAmount >= 0" [class.negative]="freeAmount < 0">
                {{ formatCurrency(freeAmount) }}
              </span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Asignado</span>
              <span class="summary-value">{{ assignedPercent }}%</span>
            </div>
          </div>
        </div>

        <!-- Items Form -->
        <div class="form-table" *ngIf="draftItems.length > 0">
          <div class="form-row header-row">
            <span>Gasto</span>
            <span>Monto</span>
            <span>%</span>
            <span>Pagado</span>
            <span>Inactivo</span>
            <span></span>
          </div>
          <div class="form-row" *ngFor="let item of draftItems" [class.row-cancelled]="item.status === 'cancelled'">
            <input type="text" [(ngModel)]="item.name" placeholder="Nombre del gasto" />
            <app-currency-input [(ngModel)]="item.amount" placeholder="0" />
            <span class="pct-cell">{{ itemPercent(item) }}%</span>
            <input class="check-cell" type="checkbox" [checked]="item.status === 'completed'"
              (change)="toggleCompleted(item, $event)" />
            <input class="check-cell" type="checkbox" [checked]="item.status === 'cancelled'"
              (change)="toggleCancelled(item, $event)" />
            <button class="btn-icon" (click)="removeDraftItem(item)" title="Eliminar">🗑️</button>
          </div>
          <button class="btn-add-row" (click)="addDraftItem()">+ Agregar Gasto</button>
        </div>

        <div class="empty-state" *ngIf="draftItems.length === 0 && !loading">
          <p>No hay gastos en este presupuesto</p>
          <button class="btn-primary" (click)="addDraftItem()">+ Agregar primer gasto</button>
        </div>
      </ng-container>

      <!-- Budget Modal -->
      <div class="modal-overlay" *ngIf="showBudgetModal" (click)="closeBudgetModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingBudgetId ? 'Editar Presupuesto' : 'Nuevo Presupuesto' }}</h2>
            <button class="btn-close" (click)="closeBudgetModal()">&times;</button>
          </div>

          <div class="form-group">
            <label for="period_type">Tipo de Quincena</label>
            <select id="period_type" [(ngModel)]="budgetForm.period_type">
              <option value="first">1ra Quincena</option>
              <option value="second">2da Quincena</option>
            </select>
          </div>

          <div class="form-group">
            <label for="start_date">Fecha Inicio</label>
            <input id="start_date" type="date" [(ngModel)]="budgetForm.start_date" />
          </div>

          <div class="form-group">
            <label for="end_date">Fecha Fin</label>
            <input id="end_date" type="date" [(ngModel)]="budgetForm.end_date" />
          </div>

          <div class="form-group">
            <label for="total_income">Ingreso Total</label>
            <app-currency-input id="total_income" [(ngModel)]="budgetForm.total_income" placeholder="0" />
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeBudgetModal()">Cancelar</button>
            <button class="btn-primary" [disabled]="saving" (click)="submitBudget()">
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>

      </div>
  `,
  styles: [`
    .page { padding: 0; }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .page-header h1 { margin: 0; color: #333; }
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .btn-back {
      background: none;
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      color: #555;
      font-size: 0.9rem;
    }
    .btn-back:hover { background: #f5f5f5; }
.detail-dates {
          color: #777;
          margin-bottom: 16px;
          font-size: 0.95rem;
        }
        .header-actions {
          display: flex;
          gap: 8px;
        }
        .btn-copy {
          background: #2196f3;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
        }
        .btn-copy:hover { background: #1976d2; }

        /* Income box */
        .income-box {
          display: flex;
          align-items: flex-end;
          gap: 32px;
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          padding: 20px 24px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .income-box .form-group { padding: 0; margin: 0; flex: 1; min-width: 200px; }
        .income-summary {
          display: flex;
          gap: 28px;
          flex-wrap: wrap;
        }

        /* Items form */
        .form-table {
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          padding: 8px 24px 24px;
        }
        .form-row {
          display: grid;
          grid-template-columns: 2fr 1fr 70px 60px 60px 40px;
          gap: 12px;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .form-row input[type="text"], .form-row input[type="number"] {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.95rem;
          box-sizing: border-box;
        }
        .form-row input:focus {
          outline: none;
          border-color: #4caf50;
        }
        .form-row .check-cell {
          width: 20px;
          height: 20px;
          justify-self: center;
        }
        .pct-cell {
          text-align: right;
          font-weight: 600;
          color: #555;
        }
        .header-row {
          font-size: 0.8rem;
          text-transform: uppercase;
          color: #888;
          font-weight: 600;
          border-bottom: 2px solid #eee;
        }
        .row-cancelled {
          opacity: 0.5;
        }
        .btn-add-row {
          margin-top: 14px;
          background: #f0f4ff;
          border: 1px dashed #b3c6e5;
          color: #1565c0;
          padding: 10px;
          width: 100%;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 500;
        }
        .btn-add-row:hover { background: #e3ecff; }

    /* Cards */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }
    .card {
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      padding: 20px;
      cursor: pointer;
      transition: box-shadow 0.2s, transform 0.15s;
    }
    .card:hover {
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      transform: translateY(-2px);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .period-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 0.8rem;
      font-weight: 600;
      color: white;
    }
    .period-badge.first { background: #4caf50; }
    .period-badge.second { background: #2196f3; }
    .card-actions {
      display: flex;
      gap: 4px;
    }
    .card-body {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .card-dates {
      color: #777;
      font-size: 0.9rem;
      margin: 0;
    }
    .card-amount {
      font-size: 1.3rem;
      font-weight: 700;
      color: #4caf50;
      margin: 0;
    }

    /* Summary Bar */
    .summary-bar {
      display: flex;
      gap: 24px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      padding: 16px 24px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .summary-label {
      font-size: 0.8rem;
      color: #888;
      text-transform: uppercase;
      font-weight: 600;
    }
    .summary-value {
      font-size: 1.1rem;
      font-weight: 700;
    }
    .summary-value.positive { color: #4caf50; }
    .summary-value.negative { color: #e53935; }
    .summary-value.warning { color: #ff9800; }

    /* Table */
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
    .amount.negative { color: #e53935; }
    .item-notes {
      margin: 2px 0 0;
      font-size: 0.8rem;
      color: #999;
    }
    .actions-cell {
      display: flex;
      gap: 4px;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .status-completed { background: #e8f5e9; color: #2e7d32; }
    .status-pending { background: #fff3e0; color: #e65100; }
    .status-cancelled { background: #ffebee; color: #c62828; }

    /* Buttons */
    .btn-primary {
      background: #4caf50;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
    }
    .btn-primary:hover { background: #43a047; }
    .btn-primary:disabled { background: #ccc; cursor: not-allowed; }
    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      padding: 4px;
    }
    .btn-pay { font-size: 1.1rem; }

    /* Empty */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
      background: white;
      border-radius: 8px;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #eee;
    }
    .modal-header h2 { margin: 0; font-size: 1.2rem; }
    .btn-close {
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #888;
    }
    .form-group {
      padding: 0 20px;
      margin-bottom: 16px;
    }
    .form-group:first-child { margin-top: 20px; }
    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      color: #333;
      cursor: pointer;
    }
    .checkbox-label input[type="checkbox"] {
      width: auto;
    }
    input, select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 1rem;
      box-sizing: border-box;
    }
    input:focus, select:focus {
      outline: none;
      border-color: #4caf50;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 20px;
      border-top: 1px solid #eee;
    }
    .btn-secondary {
      background: #f5f5f5;
      color: #333;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-secondary:hover { background: #e0e0e0; }
  `]
})
export class BudgetComponent implements OnInit {
  formatCurrency = formatCurrency;
  budgets: any[] = [];
  selectedBudget: any = null;
  draftItems: any[] = [];
  totalIncome: number | null = null;
  loading = false;

  showBudgetModal = false;
  editingBudgetId: number | null = null;
  budgetForm = { period_type: 'first', start_date: '', end_date: '', total_income: null as number | null };

  saving = false;

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadBudgets();
  }

  loadBudgets(): void {
    this.loading = true;
    this.api.get<any>('/budgets').subscribe({
      next: (res) => { this.budgets = res.data || res; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  selectBudget(budget: any): void {
    this.selectedBudget = budget;
    this.loadBudgetDetail(budget.id);
  }

  loadBudgetDetail(id: number): void {
    this.loading = true;
    this.api.get<any>(`/budgets/${id}`).subscribe({
      next: (res) => {
        const budget = res.data?.budget || res.data || res;
        const items = res.data?.items || budget.items || [];
        this.totalIncome = Number(budget.total_income) || null;
        this.draftItems = (items || []).map((i: any) => ({ ...i, amount: Number(i.amount) }));
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  backToList(): void {
    this.selectedBudget = null;
    this.draftItems = [];
    this.totalIncome = null;
    this.loadBudgets();
  }

  addDraftItem(): void {
    this.draftItems.push({ id: null, name: '', amount: null, status: 'pending', is_recurrent: false, notes: '' });
  }

  removeDraftItem(item: any): void {
    if (item.id) {
      if (!confirm('¿Eliminar este gasto?')) return;
      this.api.delete(`/budgets/${this.selectedBudget.id}/items/${item.id}`).subscribe({
        next: () => this.loadBudgetDetail(this.selectedBudget.id),
      });
    } else {
      this.draftItems = this.draftItems.filter(i => i !== item);
    }
  }

  toggleCompleted(item: any, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      item.status = 'completed';
    } else if (item.status === 'completed') {
      item.status = 'pending';
    }
  }

  toggleCancelled(item: any, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      item.status = 'cancelled';
    } else if (item.status === 'cancelled') {
      item.status = 'pending';
    }
  }

  get activeItems(): any[] {
    return this.draftItems.filter(i => i.status !== 'cancelled');
  }

  get assignedTotal(): number {
    return this.activeItems.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);
  }

  get freeAmount(): number {
    return (Number(this.totalIncome) || 0) - this.assignedTotal;
  }

  get assignedPercent(): number {
    const total = Number(this.totalIncome) || 0;
    if (total <= 0) return 0;
    return Math.round((this.assignedTotal / total) * 100);
  }

  itemPercent(item: any): number {
    const total = Number(this.totalIncome) || 0;
    if (total <= 0) return 0;
    return Math.round(((Number(item.amount) || 0) / total) * 100);
  }

  saveDraft(): void {
    this.saving = true;
    const payload: any = { items: this.draftItems.map((i: any) => ({
      id: i.id ?? undefined,
      name: i.name,
      amount: Number(i.amount) || null,
      status: i.status,
    })) };
    if (this.totalIncome != null) {
      payload.total_income = this.totalIncome;
    }
    this.api.put(`/budgets/${this.selectedBudget.id}/items/bulk`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.loadBudgetDetail(this.selectedBudget.id);
      },
      error: () => { this.saving = false; },
    });
  }

  copyNext(): void {
    if (!confirm('¿Crear la siguiente quincena con los gastos activos?')) return;
    this.saving = true;
    this.api.post(`/budgets/${this.selectedBudget.id}/copy`, {}).subscribe({
      next: (res: any) => {
        this.saving = false;
        const newBudget = res.data || res;
        this.budgets = [...this.budgets, newBudget];
        this.selectedBudget = newBudget;
        this.loadBudgetDetail(newBudget.id);
      },
      error: () => { this.saving = false; },
    });
  }

  // Budget CRUD
  openBudgetModal(): void {
    this.editingBudgetId = null;
    this.budgetForm = { period_type: 'first', start_date: '', end_date: '', total_income: null };
    this.showBudgetModal = true;
  }

  editBudget(budget: any, event: Event): void {
    event.stopPropagation();
    this.editingBudgetId = budget.id;
    this.budgetForm = {
      period_type: budget.period_type,
      start_date: budget.start_date,
      end_date: budget.end_date,
      total_income: budget.total_income,
    };
    this.showBudgetModal = true;
  }

  closeBudgetModal(): void {
    this.showBudgetModal = false;
    this.editingBudgetId = null;
  }

  submitBudget(): void {
    this.saving = true;
    const data: any = {
      period_type: this.budgetForm.period_type,
      start_date: this.budgetForm.start_date,
      end_date: this.budgetForm.end_date,
    };
    if (this.budgetForm.total_income != null) {
      data.total_income = this.budgetForm.total_income;
    }

    const request = this.editingBudgetId
      ? this.api.put(`/budgets/${this.editingBudgetId}`, data)
      : this.api.post('/budgets', data);

    request.subscribe({
      next: () => {
        this.closeBudgetModal();
        if (this.selectedBudget) {
          this.loadBudgetDetail(this.selectedBudget.id);
        } else {
          this.loadBudgets();
        }
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  deleteBudget(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('¿Eliminar este presupuesto y todos sus gastos?')) return;
    this.api.delete(`/budgets/${id}`).subscribe({ next: () => this.loadBudgets() });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = { completed: 'Pagado', pending: 'Pendiente', cancelled: 'Cancelado' };
    return labels[status] || status;
  }

}
