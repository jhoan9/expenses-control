import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';

interface ExpenseItem {
  name: string;
  amount: number | null;
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, CurrencyInputComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Gastos</h1>
        <button class="btn-primary" (click)="openModal()">+ Nuevo Gasto</button>
      </div>

      <div class="filters">
        <input type="date" [(ngModel)]="filters.date_from" (change)="loadExpenses()" />
        <input type="date" [(ngModel)]="filters.date_to" (change)="loadExpenses()" />
        <select [(ngModel)]="filters.category_id" (change)="loadExpenses()">
          <option value="">Todas las categorías</option>
          <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
        </select>
      </div>

      <div class="summary-bar">
        <span>Total:</span>
        <strong class="negative">{{ formatCurrency(totalAmount) }}</strong>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Método Pago</th>
              <th>Cuenta</th>
              <th>Monto</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of expenses">
              <td>{{ item.date | date: 'yyyy-MM-dd' }}</td>
              <td>{{ item.description || '-' }}</td>
              <td>
                <span class="category-badge" [style.background]="getCategoryColor(item.category_id)">
                  {{ getCategoryName(item.category_id) }}
                </span>
              </td>
              <td>{{ getPaymentMethodName(item.payment_method_id) }}</td>
              <td>{{ getAccountName(item.account_id) }}</td>
              <td class="amount negative">
                {{ formatCurrency(item.amount) }}
                <span class="items-count" *ngIf="item.item_count > 0" [title]="item.item_count + ' ítems'">🧾{{ item.item_count }}</span>
              </td>
              <td>
                <span class="status-badge" [class]="'status-' + item.status">
                  {{ getStatusLabel(item.status) }}
                </span>
              </td>
              <td>
                <button class="btn-icon" (click)="editItem(item)">✏️</button>
                <button class="btn-icon" (click)="deleteItem(item.id)">🗑️</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="empty-state" *ngIf="expenses.length === 0 && !loading">
        <p>No hay gastos registrados</p>
      </div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId ? 'Editar Gasto' : 'Nuevo Gasto' }}</h2>
            <button class="btn-close" (click)="closeModal()">&times;</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-row">
              <div class="form-group">
                <label for="amount">Monto</label>
                <app-currency-input id="amount" formControlName="amount" placeholder="0" />
                <small class="hint" *ngIf="items.length > 0">Monto = suma de ítems ($ {{ formatNumber(itemsTotal()) }})</small>
              </div>
              <div class="form-group">
                <label for="date">Fecha</label>
                <input id="date" type="date" formControlName="date" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="account_id">Cuenta</label>
                <select id="account_id" formControlName="account_id">
                  <option value="">Seleccionar cuenta</option>
                  <option *ngFor="let acc of accounts" [value]="acc.id">{{ acc.name }}</option>
                </select>
              </div>
              <div class="form-group">
                <label for="payment_method_id">Método de Pago</label>
                <select id="payment_method_id" formControlName="payment_method_id">
                  <option value="">Seleccionar método</option>
                  <option *ngFor="let pm of paymentMethods" [value]="pm.id">{{ pm.name }}</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="category_id">Categoría</label>
                <select id="category_id" formControlName="category_id" (change)="onCategoryChange()">
                  <option value="">Sin categoría</option>
                  <option *ngFor="let cat of expenseCategories" [value]="cat.id">{{ cat.name }}</option>
                </select>
              </div>
              <div class="form-group">
                <label for="subcategory_id">Subcategoría</label>
                <select id="subcategory_id" formControlName="subcategory_id">
                  <option value="">Sin subcategoría</option>
                  <option *ngFor="let sub of filteredSubcategories" [value]="sub.id">{{ sub.name }}</option>
                </select>
              </div>
            </div>

            <!-- Items -->
            <div class="form-group items-section">
              <div class="items-header">
                <label>Ítems <span class="hint">(opcional, ej: arroz, lenteja, carne)</span></label>
                <div class="items-actions">
                  <button type="button" class="btn-mini" *ngIf="hasTemplate()" (click)="applyTemplate()">📋 Usar plantilla</button>
                  <button type="button" class="btn-mini" (click)="saveAsTemplate()" [disabled]="templateNames().length === 0">💾 Guardar plantilla</button>
                </div>
              </div>

              <div class="item-row" *ngFor="let it of items; let i = index">
                <input type="text" [(ngModel)]="it.name" [ngModelOptions]="{ standalone: true }" placeholder="Nombre del ítem" class="item-name" />
                <app-currency-input [(ngModel)]="it.amount" [ngModelOptions]="{ standalone: true }" placeholder="0" class="item-amount"></app-currency-input>
                <button type="button" class="btn-icon" (click)="removeItem(i)">✖</button>
              </div>

              <button type="button" class="btn-add-item" (click)="addItem()">+ Agregar ítem</button>
            </div>

            <div class="form-group">
              <label for="description">Descripción</label>
              <input id="description" formControlName="description" placeholder="Descripción del gasto" />
            </div>

            <div class="form-group">
              <label for="status">Estado</label>
              <select id="status" formControlName="status">
                <option value="completed">Completado</option>
                <option value="pending">Pendiente</option>
                <option value="cancelled">Cancelado</option>
              </select>
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
  styles: [
    `
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
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .filters input, .filters select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.95rem;
    }
    .summary-bar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 1.1rem;
    }
    .negative { color: #e53935; }
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
    .amount { font-weight: 600; white-space: nowrap; }
    .items-count { font-size: 0.75rem; margin-left: 4px; opacity: 0.8; }
    .category-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      color: white;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .status-completed { background: #e8f5e9; color: #2e7d32; }
    .status-pending { background: #fff3e0; color: #e65100; }
    .status-cancelled { background: #ffebee; color: #c62828; }
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
      max-width: 560px;
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
    .form-row {
      display: flex;
      gap: 12px;
    }
    .form-group {
      padding: 0 20px;
      margin-bottom: 16px;
      flex: 1;
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
    .hint { font-weight: 400; color: #888; font-size: 0.8rem; }
    .items-section { border-top: 1px dashed #ddd; padding-top: 14px; }
    .items-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .items-actions { display: flex; gap: 6px; }
    .btn-mini {
      background: #f0f7f0;
      border: 1px solid #cde5cd;
      color: #2e7d32;
      font-size: 0.78rem;
      padding: 4px 8px;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-mini:hover { background: #e0f0e0; }
    .btn-mini:disabled { opacity: 0.5; cursor: not-allowed; }
    .item-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .item-name { flex: 1.4; }
    .item-amount { flex: 1; }
    .btn-add-item {
      width: 100%;
      background: #fafafa;
      border: 1px dashed #bbb;
      color: #666;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .btn-add-item:hover { background: #f0f0f0; }
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
export class ExpensesComponent implements OnInit {
  expenses: any[] = [];
  accounts: any[] = [];
  categories: any[] = [];
  paymentMethods: any[] = [];
  loading = false;
  showModal = false;
  editingId: number | null = null;
  saving = false;

  items: ExpenseItem[] = [];
  private templates: any[] = [];
  private templatesLoadedFor: number | null = null;

  filters: any = {
    date_from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    category_id: '',
  };

  form: FormGroup;

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.form = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      date: [new Date().toISOString().split('T')[0], [Validators.required]],
      account_id: [null, [Validators.required]],
      category_id: [null],
      subcategory_id: [null],
      payment_method_id: [null],
      description: [''],
      status: ['completed'],
    });
  }

  ngOnInit(): void {
    this.loadAccounts();
    this.loadCategories();
    this.loadPaymentMethods();
    this.loadExpenses();
  }

  loadAccounts(): void {
    this.api.get<any>('/accounts').subscribe({ next: (res) => this.accounts = res.data });
  }

  loadCategories(): void {
    this.api.get<any>('/categories?type=expense').subscribe({ next: (res) => this.categories = res.data });
  }

  loadPaymentMethods(): void {
    this.api.get<any>('/payment-methods').subscribe({ next: (res) => this.paymentMethods = res.data });
  }

  loadExpenses(): void {
    this.loading = true;
    const params = { ...this.filters };
    if (!params.category_id) delete params.category_id;
    this.api.get<any>('/expenses', params).subscribe({
      next: (res) => { this.expenses = res.data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get expenseCategories(): any[] {
    return this.categories.filter(c => c.type === 'expense' || c.type === 'both');
  }

  get filteredSubcategories(): any[] {
    const catId = this.form.get('category_id')?.value;
    if (!catId) return [];
    const cat = this.categories.find(c => c.id == catId);
    return cat?.subcategories || [];
  }

  get totalAmount(): number {
    return this.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }

  itemsTotal(): number {
    return Math.round(this.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0) * 100) / 100;
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value || 0);
  }

  onCategoryChange(): void {
    this.form.patchValue({ subcategory_id: null });
    this.syncWithCategory();
  }

  syncWithCategory(): void {
    const catId = Number(this.form.get('category_id')?.value) || null;
    if (!catId) {
      this.templates = [];
      this.templatesLoadedFor = null;
      return;
    }
    if (this.templatesLoadedFor === catId) {
      this.prefillFromTemplateIfEmpty();
      return;
    }
    this.api.get<any>(`/expenses/templates`, { category_id: catId }).subscribe({
      next: (res) => {
        this.templates = res.data || [];
        this.templatesLoadedFor = catId;
        this.prefillFromTemplateIfEmpty();
      },
      error: () => { this.templates = []; this.templatesLoadedFor = catId; },
    });
  }

  currentTemplateKeySubcategoryId(): number | null {
    const sub = this.form.get('subcategory_id')?.value;
    return sub ? Number(sub) : null;
  }

  templateNames(): string[] {
    const subId = this.currentTemplateKeySubcategoryId();
    const exact = this.templates.filter(t =>
      t.subcategory_id === subId ||
      (t.subcategory_id === null && subId === null)
    );
    const source = exact.length > 0 ? exact : this.templates.filter(t => t.subcategory_id === null);
    return source.map(t => t.name);
  }

  hasTemplate(): boolean {
    return this.templateNames().length > 0;
  }

  prefillFromTemplateIfEmpty(): void {
    if (this.editingId) return;
    if (this.items.length > 0) return;
    this.applyTemplate();
  }

  applyTemplate(): void {
    const names = this.templateNames();
    if (names.length === 0) return;
    this.items = names.map(n => ({ name: n, amount: null }));
    this.recalcAmount();
  }

  saveAsTemplate(): void {
    const names = this.items.map(i => i.name.trim()).filter(n => n.length > 0);
    if (names.length === 0) {
      alert('Agrega al menos un ítem con nombre antes de guardar la plantilla');
      return;
    }
    const catId = Number(this.form.get('category_id')?.value);
    if (!catId) {
      alert('Selecciona una categoría primero');
      return;
    }
    const subId = this.currentTemplateKeySubcategoryId();
    const label = subId
      ? `${this.getCategoryName(catId)} / ${this.filteredSubcategories.find(s => s.id == subId)?.name || ''}`
      : this.getCategoryName(catId);
    if (!confirm(`¿Guardar estos ${names.length} ítems como plantilla para "${label}"?`)) return;

    const body: any = { category_id: catId, names };
    if (subId) body.subcategory_id = subId;

    this.api.post('/expenses/templates', body).subscribe({
      next: () => {
        this.api.get<any>(`/expenses/templates`, { category_id: catId }).subscribe({
          next: (res) => { this.templates = res.data || []; this.templatesLoadedFor = catId; },
        });
      },
      error: () => alert('No se pudo guardar la plantilla'),
    });
  }

  addItem(): void {
    this.items.push({ name: '', amount: null });
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
    this.recalcAmount();
  }

  recalcAmount(): void {
    if (this.items.length > 0) {
      this.form.patchValue({ amount: this.itemsTotal() });
    }
  }

  openModal(): void {
    this.editingId = null;
    this.items = [];
    this.templates = [];
    this.templatesLoadedFor = null;
    this.form.reset({
      amount: null,
      date: new Date().toISOString().split('T')[0],
      account_id: null,
      category_id: null,
      subcategory_id: null,
      payment_method_id: null,
      description: '',
      status: 'completed',
    });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingId = null;
  }

  editItem(row: any): void {
    this.editingId = row.id;
    this.items = [];
    this.templates = [];
    this.templatesLoadedFor = null;

    this.form.patchValue({
      amount: Number(row.amount),
      date: String(row.date).split('T')[0],
      account_id: row.account_id,
      category_id: row.category_id,
      subcategory_id: row.subcategory_id,
      payment_method_id: row.payment_method_id,
      description: row.description,
      status: row.status,
    });

    this.api.get<any>(`/expenses/${row.id}`).subscribe({
      next: (res) => {
        this.items = (res.data.items || []).map((i: any) => ({ name: i.name, amount: Number(i.amount) }));
      },
    });

    if (row.category_id) {
      this.api.get<any>(`/expenses/templates`, { category_id: row.category_id }).subscribe({
        next: (res) => { this.templates = res.data || []; this.templatesLoadedFor = row.category_id; },
      });
    }

    this.showModal = true;
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const cleanedItems: ExpenseItem[] = this.items
      .map(i => ({ name: (i.name || '').trim(), amount: Number(i.amount) || 0 }))
      .filter(i => i.name.length > 0);

    const amount = cleanedItems.length > 0 ? this.itemsTotal() : Number(this.form.value.amount);

    const data: any = {
      ...this.form.value,
      amount,
      date: String(this.form.value.date).split('T')[0],
    };
    if (cleanedItems.length > 0) data.items = cleanedItems; else delete data.items;
    if (!data.category_id) delete data.category_id;
    if (!data.subcategory_id) delete data.subcategory_id;
    if (!data.payment_method_id) delete data.payment_method_id;

    const request = this.editingId
      ? this.api.put(`/expenses/${this.editingId}`, data)
      : this.api.post('/expenses', data);

    request.subscribe({
      next: () => { this.loadExpenses(); this.closeModal(); this.saving = false; },
      error: () => { this.saving = false; },
    });
  }

  deleteItem(id: number): void {
    if (!confirm('¿Eliminar este gasto?')) return;
    this.api.delete(`/expenses/${id}`).subscribe({ next: () => this.loadExpenses() });
  }

  getAccountName(id: number): string { return this.accounts.find(a => a.id === id)?.name || '-'; }
  getCategoryName(id: number): string { return this.categories.find(c => c.id === id)?.name || '-'; }
  getCategoryColor(id: number): string { return this.categories.find(c => c.id === id)?.color || '#999'; }
  getPaymentMethodName(id: number): string { return this.paymentMethods.find(p => p.id === id)?.name || '-'; }
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = { completed: 'Completado', pending: 'Pendiente', cancelled: 'Cancelado' };
    return labels[status] || status;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  }
}
