import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
          <button class="btn-primary" (click)="openItemModal()">+ Agregar Gasto</button>
        </div>

        <p class="detail-dates">{{ selectedBudget.start_date }} — {{ selectedBudget.end_date }}</p>

        <!-- Summary Bar -->
        <div class="summary-bar" *ngIf="summary">
          <div class="summary-item">
            <span class="summary-label">Ingresos</span>
            <span class="summary-value positive">{{ formatCurrency(summary.total_income) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Pagado</span>
            <span class="summary-value negative">{{ formatCurrency(summary.total_paid) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Pendiente</span>
            <span class="summary-value warning">{{ formatCurrency(summary.total_pending) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Disponible</span>
            <span class="summary-value" [class.positive]="summary.remaining >= 0" [class.negative]="summary.remaining < 0">
              {{ formatCurrency(summary.remaining) }}
            </span>
          </div>
        </div>

        <!-- Items Table -->
        <div class="table-container" *ngIf="items.length > 0">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Monto</th>
                <th>Fecha Límite</th>
                <th>Estado</th>
                <th>Recurrente</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of items">
                <td>
                  {{ item.name }}
                  <p class="item-notes" *ngIf="item.notes">{{ item.notes }}</p>
                </td>
                <td class="amount negative">{{ formatCurrency(item.amount) }}</td>
                <td>{{ item.due_date }}</td>
                <td>
                  <span class="status-badge" [class]="'status-' + item.status">
                    {{ getStatusLabel(item.status) }}
                  </span>
                </td>
                <td>{{ item.is_recurrent ? 'Sí' : 'No' }}</td>
                <td class="actions-cell">
                  <button class="btn-icon btn-pay" *ngIf="item.status === 'pending'" (click)="payItem(item)" title="Marcar pagado">✅</button>
                  <button class="btn-icon" (click)="editItem(item)" title="Editar">✏️</button>
                  <button class="btn-icon" (click)="deleteItem(item)" title="Eliminar">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" *ngIf="items.length === 0 && !loading">
          <p>No hay gastos en este presupuesto</p>
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
            <input id="total_income" type="number" [(ngModel)]="budgetForm.total_income" placeholder="0" />
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeBudgetModal()">Cancelar</button>
            <button class="btn-primary" [disabled]="saving" (click)="submitBudget()">
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Item Modal -->
      <div class="modal-overlay" *ngIf="showItemModal" (click)="closeItemModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingItemId ? 'Editar Gasto' : 'Nuevo Gasto' }}</h2>
            <button class="btn-close" (click)="closeItemModal()">&times;</button>
          </div>

          <div class="form-group">
            <label for="item_name">Nombre</label>
            <input id="item_name" type="text" [(ngModel)]="itemForm.name" placeholder="Nombre del gasto" />
          </div>

          <div class="form-group">
            <label for="item_amount">Monto</label>
            <input id="item_amount" type="number" [(ngModel)]="itemForm.amount" placeholder="0" />
          </div>

          <div class="form-group">
            <label for="item_due_date">Fecha Límite</label>
            <input id="item_due_date" type="date" [(ngModel)]="itemForm.due_date" />
          </div>

          <div class="form-group" *ngIf="editingItemId">
            <label for="item_status">Estado</label>
            <select id="item_status" [(ngModel)]="itemForm.status">
              <option value="pending">Pendiente</option>
              <option value="completed">Completado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="itemForm.is_recurrent" />
              Recurrente
            </label>
          </div>

          <div class="form-group">
            <label for="item_notes">Notas</label>
            <input id="item_notes" type="text" [(ngModel)]="itemForm.notes" placeholder="Notas opcionales" />
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeItemModal()">Cancelar</button>
            <button class="btn-primary" [disabled]="saving" (click)="submitItem()">
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
  budgets: any[] = [];
  selectedBudget: any = null;
  items: any[] = [];
  summary: any = null;
  loading = false;

  showBudgetModal = false;
  editingBudgetId: number | null = null;
  budgetForm = { period_type: 'first', start_date: '', end_date: '', total_income: null as number | null };

  showItemModal = false;
  editingItemId: number | null = null;
  itemForm = { name: '', amount: null as number | null, due_date: '', status: 'pending', is_recurrent: false, notes: '' };

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
        this.items = res.data?.items || res.items || [];
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
    this.api.get<any>(`/budgets/${id}/summary`).subscribe({
      next: (res) => { this.summary = res.data?.summary || res.summary || res; },
    });
  }

  backToList(): void {
    this.selectedBudget = null;
    this.items = [];
    this.summary = null;
    this.loadBudgets();
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

  // Item CRUD
  openItemModal(): void {
    this.editingItemId = null;
    this.itemForm = { name: '', amount: null, due_date: '', status: 'pending', is_recurrent: false, notes: '' };
    this.showItemModal = true;
  }

  editItem(item: any): void {
    this.editingItemId = item.id;
    this.itemForm = {
      name: item.name,
      amount: item.amount,
      due_date: item.due_date,
      status: item.status,
      is_recurrent: item.is_recurrent || false,
      notes: item.notes || '',
    };
    this.showItemModal = true;
  }

  closeItemModal(): void {
    this.showItemModal = false;
    this.editingItemId = null;
  }

  submitItem(): void {
    this.saving = true;
    const data: any = {
      name: this.itemForm.name,
      amount: this.itemForm.amount,
      due_date: this.itemForm.due_date,
      is_recurrent: this.itemForm.is_recurrent,
      notes: this.itemForm.notes,
    };
    if (this.editingItemId) {
      data.status = this.itemForm.status;
    }

    const request = this.editingItemId
      ? this.api.put(`/budgets/${this.selectedBudget.id}/items/${this.editingItemId}`, data)
      : this.api.post(`/budgets/${this.selectedBudget.id}/items`, data);

    request.subscribe({
      next: () => {
        this.closeItemModal();
        this.loadBudgetDetail(this.selectedBudget.id);
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  deleteItem(item: any): void {
    if (!confirm('¿Eliminar este gasto?')) return;
    this.api.delete(`/budgets/${this.selectedBudget.id}/items/${item.id}`).subscribe({
      next: () => this.loadBudgetDetail(this.selectedBudget.id),
    });
  }

  payItem(item: any): void {
    const today = new Date().toISOString().split('T')[0];
    this.api.put(`/budgets/${this.selectedBudget.id}/items/${item.id}`, {
      status: 'completed',
      paid_date: today,
    }).subscribe({
      next: () => this.loadBudgetDetail(this.selectedBudget.id),
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = { completed: 'Pagado', pending: 'Pendiente', cancelled: 'Cancelado' };
    return labels[status] || status;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  }
}
