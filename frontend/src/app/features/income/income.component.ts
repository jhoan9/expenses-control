import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { formatCurrency, todayLocal } from '../../shared/utils/format';

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
        <input type="date" [(ngModel)]="filters.date_from" (change)="onFiltersChange()" placeholder="Desde" />
        <input type="date" [(ngModel)]="filters.date_to" (change)="onFiltersChange()" placeholder="Hasta" />
        <select [(ngModel)]="filters.category_id" (change)="onFiltersChange()">
          <option value="">Todas las categorías</option>
          <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
        </select>
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
              <td>
                <span class="category-badge" [style.background]="getCategoryColor(item.category_id)">
                  {{ getCategoryName(item.category_id) }}
                </span>
                <span *ngIf="item.subcategory_id" class="subcategory-name">› {{ getSubcategoryName(item.subcategory_id) }}</span>
              </td>
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

      <div class="pagination" *ngIf="totalPages > 1">
        <span class="page-info">
          Mostrando {{ pageFirst }}–{{ pageLast }} de {{ totalItems }} · Página {{ page }} de {{ totalPages }}
        </span>
        <div class="page-buttons">
          <button class="btn-mini" (click)="goToPage(page - 1)" [disabled]="page <= 1">← Anterior</button>
          <button class="btn-mini page-num" *ngFor="let p of pageNumbers" [class.active]="p === page" (click)="goToPage(p)">{{ p }}</button>
          <button class="btn-mini" (click)="goToPage(page + 1)" [disabled]="page >= totalPages">Siguiente →</button>
        </div>
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
              <select id="category_id" formControlName="category_id" (change)="onCategoryChange()">
                <option value="">Sin categoría</option>
                <option *ngFor="let cat of categories" [value]="cat.id">{{ cat.name }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="subcategory_id">Subcategoría</label>
              <select id="subcategory_id" formControlName="subcategory_id">
                <option value="">Sin subcategoría</option>
                <option *ngFor="let sub of filteredSubcategories" [value]="sub.id">{{ sub.name }}</option>
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
  `
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
  filters: any = { date_from: '', date_to: '', category_id: '' };
  form: FormGroup;

  page = 1;
  pageSize = 20;
  totalItems = 0;
  totalPages = 1;
  totalSum = 0;

  constructor(private api: ApiService, private fb: FormBuilder) {
    const today = todayLocal();
    this.filters.date_from = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    this.filters.date_to = today;

    this.form = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.00000001)]],
      date: [today, [Validators.required]],
      account_id: [null, [Validators.required]],
      category_id: [null],
      subcategory_id: [null],
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
    const params: any = { ...this.filters, page: this.page, limit: this.pageSize };
    if (!params.category_id) delete params.category_id;
    this.api.get<any>('/income', params).subscribe({
      next: (res) => {
        this.income = res.data;
        this.totalItems = res.pagination?.total ?? 0;
        this.totalPages = Math.max(1, res.pagination?.totalPages ?? 1);
        this.totalSum = res.pagination?.totalAmount ?? this.income.reduce((sum, i) => sum + Number(i.amount), 0);
        if (this.income.length === 0 && this.totalItems > 0 && this.page > this.totalPages) {
          this.page = this.totalPages;
          this.loadIncome();
          return;
        }
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  onFiltersChange(): void {
    this.page = 1;
    this.loadIncome();
  }

  goToPage(p: number): void {
    const target = Math.max(1, Math.min(p, this.totalPages));
    if (target === this.page) return;
    this.page = target;
    this.loadIncome();
  }

  get pageFirst(): number {
    return this.totalItems === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get pageLast(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }

  get pageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.page;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(current - 2, total - 4));
    return Array.from({ length: 5 }, (_, i) => start + i);
  }

  get totalAmount(): number {
    return this.totalSum;
  }

  get filteredSubcategories(): any[] {
    const catId = this.form.get('category_id')?.value;
    if (!catId) return [];
    const cat = this.categories.find(c => c.id == catId);
    return cat?.subcategories || [];
  }

  onCategoryChange(): void {
    this.form.patchValue({ subcategory_id: null });
  }

  openModal(): void {
    this.editingId = null;
    const today = todayLocal();
    this.form.reset({ amount: null, date: today, account_id: null, category_id: null, subcategory_id: null, description: '' });
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
      subcategory_id: item.subcategory_id,
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
      next: () => {
        if (!this.editingId) this.page = 1;
        this.loadIncome();
        this.closeModal();
        this.saving = false;
      },
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

  getCategoryColor(id: number): string {
    return this.categories.find(c => c.id === id)?.color || '#999';
  }

  getSubcategoryName(id: number): string {
    for (const cat of this.categories) {
      const subs: any[] = cat.subcategories || [];
      const sub = subs.find(s => s.id === id);
      if (sub) return sub.name;
    }
    return '-';
  }

}