import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-payment-methods',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Métodos de Pago</h1>
        <button class="btn-primary" (click)="openModal()">+ Nuevo Método</button>
      </div>

      <div class="cards-grid">
        <div class="method-card" *ngFor="let method of methods">
          <div class="method-header">
            <span class="method-icon">{{ method.icon || getTypeIcon(method.type) }}</span>
            <div class="method-actions">
              <button class="btn-icon" (click)="editMethod(method)">✏️</button>
              <button class="btn-icon" (click)="deleteMethod(method.id)">🗑️</button>
            </div>
          </div>
          <h3>{{ method.name }}</h3>
          <span class="type-badge" [ngClass]="'type-' + method.type">{{ getTypeLabel(method.type) }}</span>
          <p class="method-status" [class.active]="method.is_active">
            {{ method.is_active ? 'Activo' : 'Inactivo' }}
          </p>
        </div>
      </div>

      <div class="empty-state" *ngIf="methods.length === 0 && !loading">
        <p>No hay métodos de pago registrados</p>
        <button class="btn-primary" (click)="openModal()">Crear primer método</button>
      </div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId ? 'Editar Método de Pago' : 'Nuevo Método de Pago' }}</h2>
            <button class="btn-close" (click)="closeModal()">&times;</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="name">Nombre</label>
              <input id="name" formControlName="name" placeholder="Ej: Nequi" />
            </div>

            <div class="form-group">
              <label for="type">Tipo</label>
              <select id="type" formControlName="type">
                <option value="">Seleccionar tipo</option>
                <option value="cash">Efectivo</option>
                <option value="credit_card">Tarjeta de Crédito</option>
                <option value="debit_card">Tarjeta Débito</option>
                <option value="bank_transfer">Transferencia Bancaria</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div class="form-group">
              <label for="icon">Icono</label>
              <input id="icon" formControlName="icon" placeholder="Ej: 💳 o texto" />
            </div>

            <div class="form-group" *ngIf="editingId">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="is_active" />
                Activo
              </label>
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
export class PaymentMethodsComponent implements OnInit {
  methods: any[] = [];
  loading = false;
  showModal = false;
  editingId: number | null = null;
  saving = false;
  form: FormGroup;

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      type: ['other'],
      icon: [''],
      is_active: [true],
    });
  }

  ngOnInit(): void {
    this.loadMethods();
  }

  loadMethods(): void {
    this.loading = true;
    this.api.get<any>('/payment-methods').subscribe({
      next: (res) => { this.methods = res.data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  openModal(): void {
    this.editingId = null;
    this.form.reset({ name: '', type: 'other', icon: '', is_active: true });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingId = null;
  }

  editMethod(method: any): void {
    this.editingId = method.id;
    this.form.patchValue({
      name: method.name,
      type: method.type,
      icon: method.icon || '',
      is_active: method.is_active,
    });
    this.showModal = true;
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const payload = { ...this.form.value };
    if (!payload.icon) delete payload.icon;
    if (this.editingId && !payload.is_active) payload.is_active = false;

    const request = this.editingId
      ? this.api.put(`/payment-methods/${this.editingId}`, payload)
      : this.api.post('/payment-methods', payload);

    request.subscribe({
      next: () => { this.loadMethods(); this.closeModal(); this.saving = false; },
      error: () => { this.saving = false; },
    });
  }

  deleteMethod(id: number): void {
    if (!confirm('¿Eliminar este método de pago?')) return;
    this.api.delete(`/payment-methods/${id}`).subscribe({
      next: () => this.loadMethods(),
    });
  }

  getTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      cash: '💵', credit_card: '💳', debit_card: '💳',
      bank_transfer: '🏦', other: '💰',
    };
    return icons[type] || '💰';
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      cash: 'Efectivo', credit_card: 'Crédito', debit_card: 'Débito',
      bank_transfer: 'Transferencia', other: 'Otro',
    };
    return labels[type] || type;
  }
}
