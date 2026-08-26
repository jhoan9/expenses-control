import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { formatCurrency } from '../../shared/utils/format';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Categorías</h1>
        <button class="btn-primary" (click)="openCategoryModal()">+ Nueva Categoría</button>
      </div>

      <div class="filter-tabs">
        <button [class.active]="activeFilter === 'all'" (click)="setFilter('all')">Todas</button>
        <button [class.active]="activeFilter === 'expense'" (click)="setFilter('expense')">Gastos</button>
        <button [class.active]="activeFilter === 'income'" (click)="setFilter('income')">Ingresos</button>
        <button [class.active]="activeFilter === 'both'" (click)="setFilter('both')">Ambos</button>
      </div>

      <div class="cards-grid">
        <div class="category-card" *ngFor="let cat of filteredCategories">
          <div class="card-header">
            <h3>{{ cat.name }}</h3>
            <div class="card-actions">
              <button class="btn-icon" (click)="openCategoryModal(cat)">✏️</button>
              <button class="btn-icon" (click)="deleteCategory(cat.id)">🗑️</button>
            </div>
          </div>

          <div class="subcategories-section">
            <div class="subcategory-item" *ngFor="let sub of cat.subcategories">
              <div class="subcategory-info" *ngIf="editingSubId !== sub.id">
                <span class="subcategory-name" [class.inactive]="!sub.is_active">{{ sub.name }}</span>
              </div>
              <div class="subcategory-edit" *ngIf="editingSubId === sub.id">
                <input [(ngModel)]="editingSubName" (keyup.enter)="saveSubcategory(cat.id, sub)" (keyup.escape)="cancelSubEdit()" class="sub-input" />
              </div>
              <div class="subcategory-actions">
                <button class="btn-icon-sm" *ngIf="editingSubId !== sub.id" (click)="startEditSub(sub)">✏️</button>
                <button class="btn-icon-sm" *ngIf="editingSubId === sub.id" (click)="saveSubcategory(cat.id, sub)">✓</button>
                <button class="btn-icon-sm" *ngIf="editingSubId === sub.id" (click)="cancelSubEdit()">✕</button>
                <button class="btn-icon-sm" *ngIf="editingSubId !== sub.id" (click)="deleteSubcategory(cat.id, sub.id)">🗑️</button>
              </div>
            </div>

            <div class="subcategory-form" *ngIf="subInputFor === cat.id">
              <input [(ngModel)]="newSubName" placeholder="Nueva subcategoría" class="sub-input" (keyup.enter)="addSubcategory(cat.id)" />
              <button class="btn-icon-sm btn-add" (click)="addSubcategory(cat.id)" [disabled]="!newSubName.trim()">✓</button>
              <button class="btn-icon-sm" (click)="cancelAddSub()">✕</button>
            </div>
            <button class="btn-add-sub" *ngIf="subInputFor !== cat.id" (click)="startAddSub(cat.id)">+ Agregar subcategoría</button>
          </div>
        </div>
      </div>

      <div class="empty-state" *ngIf="filteredCategories.length === 0 && !loading">
        <p>No hay categorías registradas</p>
        <button class="btn-primary" (click)="openCategoryModal()">Crear primera categoría</button>
      </div>

      <!-- Category Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingCategoryId ? 'Editar Categoría' : 'Nueva Categoría' }}</h2>
            <button class="btn-close" (click)="closeModal()">&times;</button>
          </div>

          <form [formGroup]="categoryForm" (ngSubmit)="onSubmitCategory()">
            <div class="form-group">
              <label for="cat-name">Nombre</label>
              <input id="cat-name" formControlName="name" placeholder="Ej: Alimentación" />
            </div>

            <div class="form-group">
              <label for="cat-type">Tipo</label>
              <select id="cat-type" formControlName="type">
                <option value="">Seleccionar tipo</option>
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
                <option value="both">Ambos</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="cat-icon">Icono</label>
                <input id="cat-icon" formControlName="icon" placeholder="Ej: 🍔" />
              </div>
              <div class="form-group">
                <label for="cat-color">Color</label>
                <input id="cat-color" type="color" formControlName="color" />
              </div>
            </div>

            <div class="form-group" *ngIf="editingCategoryId">
              <label class="toggle-label">
                <input type="checkbox" formControlName="is_active" />
                <span>Activa</span>
              </label>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="categoryForm.invalid || saving">
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
    .filter-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }
    .filter-tabs button {
      padding: 8px 16px;
      border: 1px solid #ddd;
      background: white;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.9rem;
      color: #666;
      transition: all 0.2s;
    }
    .filter-tabs button:hover { border-color: #4caf50; color: #4caf50; }
    .filter-tabs button.active {
      background: #4caf50;
      color: white;
      border-color: #4caf50;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }
    .category-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s;
    }
    .category-card:hover { transform: translateY(-2px); }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .card-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .color-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .card-icon { font-size: 1.3rem; }
    .card-header h3 { margin: 0; color: #333; }
    .card-actions { display: flex; gap: 2px; }
    .card-type { margin-bottom: 12px; }
    .type-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .type-expense { background: #ffebee; color: #c62828; }
    .type-income { background: #e8f5e9; color: #2e7d32; }
    .type-both { background: #e3f2fd; color: #1565c0; }
    .subcategories-section {
      border-top: 1px solid #f0f0f0;
      padding-top: 10px;
      margin-top: 8px;
    }
    .subcategory-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
    }
    .subcategory-name { color: #555; font-size: 0.9rem; }
    .subcategory-name.inactive { color: #bbb; text-decoration: line-through; }
    .subcategory-actions { display: flex; gap: 2px; }
    .subcategory-form {
      display: flex;
      gap: 6px;
      align-items: center;
      padding-top: 4px;
    }
    .sub-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.9rem;
    }
    .sub-input:focus { outline: none; border-color: #4caf50; }
    .sub-hint {
      border-top: 1px solid #f0f0f0;
      padding-top: 10px;
      margin-top: 8px;
      color: #bbb;
      font-size: 0.85rem;
      font-style: italic;
    }
    .btn-add-sub {
      margin-top: 8px;
      background: none;
      border: 1px dashed #c5d3ea;
      color: #1565c0;
      width: 100%;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .btn-add-sub:hover { background: #f0f4ff; }
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
      border-radius: 4px;
    }
    .btn-icon:hover { background: #f0f0f0; }
    .btn-icon-sm {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.85rem;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .btn-icon-sm:hover { background: #f0f0f0; }
    .btn-icon-sm.btn-add { color: #4caf50; font-weight: bold; }
    .btn-icon-sm:disabled { color: #ccc; cursor: not-allowed; }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
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
    .form-group:first-of-type { margin-top: 20px; }
    .form-row {
      display: flex;
      gap: 12px;
    }
    .form-row .form-group { flex: 1; }
    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
    }
    .toggle-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .toggle-label input[type="checkbox"] { width: auto; }
    input, select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 1rem;
      box-sizing: border-box;
    }
    input[type="color"] {
      padding: 4px;
      height: 42px;
      cursor: pointer;
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
export class CategoriesComponent implements OnInit {
  formatCurrency = formatCurrency;
  categories: any[] = [];
  loading = false;
  showModal = false;
  editingCategoryId: number | null = null;
  saving = false;
  activeFilter = 'all';

  categoryForm: FormGroup;

  newSubName = '';
  subInputFor: number | null = null;

  editingSubId: number | null = null;
  editingSubName = '';

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.categoryForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      type: ['', [Validators.required]],
      icon: [''],
      color: ['#4caf50'],
      is_active: [true],
    });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  get filteredCategories(): any[] {
    if (this.activeFilter === 'all') return this.categories;
    return this.categories.filter(c => c.type === this.activeFilter);
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
  }

  loadCategories(): void {
    this.loading = true;
    this.api.get<any>('/categories').subscribe({
      next: (res) => { this.categories = res.data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  openCategoryModal(category?: any): void {
    if (category) {
      this.editingCategoryId = category.id;
      this.categoryForm.patchValue({
        name: category.name,
        type: category.type,
        icon: category.icon || '',
        color: category.color || '#4caf50',
        is_active: category.is_active !== false,
      });
    } else {
      this.editingCategoryId = null;
      this.categoryForm.reset({ name: '', type: '', icon: '', color: '#4caf50', is_active: true });
    }
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingCategoryId = null;
  }

  onSubmitCategory(): void {
    if (this.categoryForm.invalid) return;
    this.saving = true;

    const data: any = { ...this.categoryForm.value };
    if (!data.icon) delete data.icon;

    const request = this.editingCategoryId
      ? this.api.put(`/categories/${this.editingCategoryId}`, data)
      : this.api.post('/categories', data);

    request.subscribe({
      next: () => { this.loadCategories(); this.closeModal(); this.saving = false; },
      error: () => { this.saving = false; },
    });
  }

  deleteCategory(id: number): void {
    if (!confirm('¿Eliminar esta categoría y todas sus subcategorías?')) return;
    this.api.delete(`/categories/${id}`).subscribe({ next: () => this.loadCategories() });
  }

  startAddSub(categoryId: number): void {
    this.subInputFor = categoryId;
    this.newSubName = '';
  }

  cancelAddSub(): void {
    this.subInputFor = null;
    this.newSubName = '';
  }

  addSubcategory(categoryId: number): void {
    const name = this.newSubName.trim();
    if (!name) return;
    this.api.post(`/categories/${categoryId}/subcategories`, { name }).subscribe({
      next: () => { this.loadCategories(); this.cancelAddSub(); },
    });
  }

  startEditSub(sub: any): void {
    this.editingSubId = sub.id;
    this.editingSubName = sub.name;
  }

  saveSubcategory(categoryId: number, sub: any): void {
    const name = this.editingSubName.trim();
    if (!name) return;
    this.api.put(`/categories/${categoryId}/subcategories/${sub.id}`, { name }).subscribe({
      next: () => { this.loadCategories(); this.cancelSubEdit(); },
    });
  }

  cancelSubEdit(): void {
    this.editingSubId = null;
    this.editingSubName = '';
  }

  deleteSubcategory(categoryId: number, subId: number): void {
    if (!confirm('¿Eliminar esta subcategoría?')) return;
    this.api.delete(`/categories/${categoryId}/subcategories/${subId}`).subscribe({
      next: () => this.loadCategories(),
    });
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = { expense: 'Gasto', income: 'Ingreso', both: 'Ambos' };
    return labels[type] || type;
  }

}
