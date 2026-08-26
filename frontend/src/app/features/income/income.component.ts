import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { formatCurrency } from '../../shared/utils/format';

@Component({
  selector: 'app-income',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, CurrencyInputComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Ingresos</h1>
        <button class="btn-primary" (click)="openModal()">+ Nuevo Ingreso</button>
      </div>

      <div class="filters">
        <input type="date" [(ngModel)]="filters.date_from" (change)="loadIncome()" placeholder="Desde" />
        <input type="date" [(ngModel)]="filters.date_to" (change)="loadIncome()" placeholder="Hasta" />
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Cuenta</th>
              <th>Monto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of income">
              <td>{{ item.date }}</td>
              <td>{{ item.description || '-' }}</td>
              <td>{{ getCategoryName(item.category_id) }}</td>
              <td>{{ getAccountName(item.account_id) }}</td>
              <td class="amount positive">{{ formatCurrency(item.amount) }}</td>
              <td>
                <button class="btn-icon" (click)="editItem(item)">✏️</button>
                <button class="btn-icon" (click)="deleteItem(item.id)">🗑️</button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4"><strong>Total</strong></td>
              <td class="amount positive"><strong>{{ formatCurrency(totalAmount) }}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="empty-state" *ngIf="income.length === 0 && !loading">
        <p>No hay ingresos registrados</p>
      </div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId ? 'Editar Ingreso' : 'Nuevo Ingreso' }}</h2>
            <button class="btn-close" (click)="closeModal()">&times;</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="amount">Monto</label>
              <app-currency-input id="amount" formControlName="amount" placeholder="0" />
            </div>

            <div class="form-group">
              <label for="date">Fecha</label>
              <input id="date" type="date" formControlName="date" />
            </div>

            <div class="form-group">
              <label for="account_id">Cuenta</label>
              <select id="account_id" formControlName="account_id">
                <option value="">Seleccionar cuenta</option>
                <option *ngFor="let acc of accounts" [value]="acc.id">{{ acc.name }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="category_id">Categoría</label>
              <select id="category_id" formControlName="category_id">
                <option value="">Sin categoría</option>
                <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="description">Descripción</label>
              <input id="description" formControlName="description" placeholder="Descripción del ingreso" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="form.invalid || saving">
                {{ saving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
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
    .filters {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }
    .filters input {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.95rem;
    }
    .table-container {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
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
    .amount.positive { color: #4caf50; }
    .amount.negative { color: #e53935; }
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
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
      background: white;
      border-radius: 8px;
    }
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
    .form-group:first-of-type { margin-top: 20px; }
    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
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
export class IncomeComponent implements OnInit {
  formatCurrency = formatCurrency;
  income: any[] = [];
  accounts: any[] = [];
  categories: any[] = [];
  loading = false;
  showModal = false;
  editingId: number | null = null;
  saving = false;
  filters: any = { date_from: '', date_to: '' };
  form: FormGroup;

  constructor(private api: ApiService, private fb: FormBuilder) {
    const today = new Date().toISOString().split('T')[0];
    this.filters.date_from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    this.filters.date_to = today;

    this.form = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      date: [today, [Validators.required]],
      account_id: [null, [Validators.required]],
      category_id: [null],
      description: [''],
    });
  }

  ngOnInit(): void {
    this.loadAccounts();
    this.loadCategories();
    this.loadIncome();
  }

  loadAccounts(): void {
    this.api.get<any>('/accounts').subscribe({ next: (res) => this.accounts = res.data });
  }

  loadCategories(): void {
    this.api.get<any>('/categories?type=income').subscribe({ next: (res) => this.categories = res.data });
  }

  loadIncome(): void {
    this.loading = true;
    this.api.get<any>('/income', this.filters).subscribe({
      next: (res) => { this.income = res.data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get totalAmount(): number {
    return this.income.reduce((sum, i) => sum + Number(i.amount), 0);
  }

  openModal(): void {
    this.editingId = null;
    const today = new Date().toISOString().split('T')[0];
    this.form.reset({ amount: null, date: today, account_id: null, category_id: null, description: '' });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingId = null;
  }

  editItem(item: any): void {
    this.editingId = item.id;
    this.form.patchValue({
      amount: item.amount,
      date: item.date,
      account_id: item.account_id,
      category_id: item.category_id,
      description: item.description,
    });
    this.showModal = true;
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const request = this.editingId
      ? this.api.put(`/income/${this.editingId}`, this.form.value)
      : this.api.post('/income', this.form.value);

    request.subscribe({
      next: () => { this.loadIncome(); this.closeModal(); this.saving = false; },
      error: () => { this.saving = false; },
    });
  }

  deleteItem(id: number): void {
    if (!confirm('¿Eliminar este ingreso?')) return;
    this.api.delete(`/income/${id}`).subscribe({ next: () => this.loadIncome() });
  }

  getAccountName(id: number): string {
    return this.accounts.find(a => a.id === id)?.name || '-';
  }

  getCategoryName(id: number): string {
    return this.categories.find(c => c.id === id)?.name || '-';
  }

}
