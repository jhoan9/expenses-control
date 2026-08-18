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
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .method-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s;
    }
    .method-card:hover { transform: translateY(-2px); }
    .method-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .method-icon { font-size: 2rem; }
    .method-actions { display: flex; gap: 4px; }
    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      padding: 4px;
      border-radius: 4px;
    }
    .btn-icon:hover { background: #f0f0f0; }
    .method-card h3 { margin: 0 0 8px 0; color: #333; }
    .type-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .type-cash { background: #e8f5e9; color: #2e7d32; }
    .type-credit_card { background: #e3f2fd; color: #1565c0; }
    .type-debit_card { background: #fff3e0; color: #e65100; }
    .type-bank_transfer { background: #f3e5f5; color: #6a1b9a; }
    .type-other { background: #f5f5f5; color: #616161; }
    .method-status {
      margin: 10px 0 0 0;
      font-size: 0.85rem;
      color: #e53935;
    }
    .method-status.active { color: #4caf50; }
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
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
    }
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
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
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }
    .checkbox-label input[type="checkbox"] {
      width: auto;
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
