import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Cuentas</h1>
        <button class="btn-primary" (click)="openModal()">+ Nueva Cuenta</button>
      </div>

      <div class="cards-grid">
        <div class="account-card" *ngFor="let account of accounts">
          <div class="account-header">
            <span class="account-icon">{{ getAccountIcon(account.type) }}</span>
            <div class="account-actions">
              <button class="btn-icon" (click)="editAccount(account)">✏️</button>
              <button class="btn-icon" (click)="deleteAccount(account.id)">🗑️</button>
            </div>
          </div>
          <h3>{{ account.name }}</h3>
          <p class="account-type">{{ getAccountTypeLabel(account.type) }}</p>
          <p class="account-balance">{{ formatCurrency(account.balance) }}</p>
        </div>
      </div>

      <div class="empty-state" *ngIf="accounts.length === 0 && !loading">
        <p>No hay cuentas registradas</p>
        <button class="btn-primary" (click)="openModal()">Crear primera cuenta</button>
      </div>

      <!-- Modal -->
      <div class="modal-overlay" *ngIf="showModal" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingId ? 'Editar Cuenta' : 'Nueva Cuenta' }}</h2>
            <button class="btn-close" (click)="closeModal()">&times;</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="name">Nombre</label>
              <input id="name" formControlName="name" placeholder="Ej: Bancolombia" />
            </div>

            <div class="form-group">
              <label for="type">Tipo</label>
              <select id="type" formControlName="type">
                <option value="">Seleccionar tipo</option>
                <option value="savings">Ahorros</option>
                <option value="checking">Corriente</option>
                <option value="cash">Efectivo</option>
                <option value="investment">Inversión</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div class="form-group">
              <label for="balance">Saldo Inicial</label>
              <input id="balance" type="number" formControlName="balance" placeholder="0" />
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
    .account-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s;
    }
    .account-card:hover { transform: translateY(-2px); }
    .account-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .account-icon { font-size: 2rem; }
    .account-actions { display: flex; gap: 4px; }
    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      padding: 4px;
      border-radius: 4px;
    }
    .btn-icon:hover { background: #f0f0f0; }
    .account-card h3 { margin: 0 0 4px 0; color: #333; }
    .account-type { color: #888; font-size: 0.9rem; margin: 0 0 12px 0; }
    .account-balance {
      font-size: 1.8rem;
      font-weight: 700;
      color: #4caf50;
      margin: 0;
    }
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
export class AccountsComponent implements OnInit {
  accounts: any[] = [];
  loading = false;
  showModal = false;
  editingId: number | null = null;
  saving = false;
  form: FormGroup;

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      type: ['', [Validators.required]],
      balance: [0, [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.loading = true;
    this.api.get<any>('/accounts').subscribe({
      next: (res) => { this.accounts = res.data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  openModal(): void {
    this.editingId = null;
    this.form.reset({ name: '', type: '', balance: 0 });
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingId = null;
  }

  editAccount(account: any): void {
    this.editingId = account.id;
    this.form.patchValue({ name: account.name, type: account.type, balance: account.balance });
    this.showModal = true;
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const request = this.editingId
      ? this.api.put(`/accounts/${this.editingId}`, this.form.value)
      : this.api.post('/accounts', this.form.value);

    request.subscribe({
      next: () => { this.loadAccounts(); this.closeModal(); this.saving = false; },
      error: () => { this.saving = false; },
    });
  }

  deleteAccount(id: number): void {
    if (!confirm('¿Eliminar esta cuenta?')) return;
    this.api.delete(`/accounts/${id}`).subscribe({
      next: () => this.loadAccounts(),
    });
  }

  getAccountIcon(type: string): string {
    const icons: Record<string, string> = { savings: '🏦', checking: '💳', cash: '💵', investment: '📈', other: '💰' };
    return icons[type] || '💰';
  }

  getAccountTypeLabel(type: string): string {
    const labels: Record<string, string> = { savings: 'Ahorros', checking: 'Corriente', cash: 'Efectivo', investment: 'Inversión', other: 'Otro' };
    return labels[type] || type;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  }
}
