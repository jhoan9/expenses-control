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
  `
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
