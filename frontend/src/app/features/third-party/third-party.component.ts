import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';

@Component({
  selector: 'app-third-party',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyInputComponent],
  template: `
    <div class="page">
      <!-- List View -->
      <div *ngIf="selectedAccount === null">
        <div class="page-header">
          <h1>Terceros</h1>
          <button class="btn-primary" (click)="openAccountModal()">+ Nuevo Tercero</button>
        </div>

        <div class="summary-bar" *ngIf="accounts.length > 0">
          <div class="summary-item">
            <span>Total Aportado</span>
            <strong>{{ formatCurrency(getTotalContributed()) }}</strong>
          </div>
          <div class="summary-item">
            <span>Total Invertido</span>
            <strong>{{ formatCurrency(getTotalInvested()) }}</strong>
          </div>
          <div class="summary-item">
            <span>Total Disponible</span>
            <strong>{{ formatCurrency(getTotalAvailable()) }}</strong>
          </div>
          <div class="summary-item">
            <span>Total Ganancias</span>
            <strong [class.positive]="getTotalGains() >= 0" [class.negative]="getTotalGains() < 0">
              {{ formatCurrency(getTotalGains()) }}
            </strong>
          </div>
        </div>

        <div class="cards-grid">
          <div class="account-card" *ngFor="let account of accounts">
            <div class="card-header">
              <h3>{{ account.person_name }}</h3>
              <div class="card-actions">
                <button class="btn-icon" (click)="editAccount(account, $event)">✏️</button>
                <button class="btn-icon" (click)="deleteAccount(account.id, $event)">🗑️</button>
              </div>
            </div>
            <div class="card-values">
              <div class="card-row">
                <span>Aportado</span>
                <strong>{{ formatCurrency(account.total_contributed) }}</strong>
              </div>
              <div class="card-row">
                <span>Invertido</span>
                <strong>{{ formatCurrency(account.total_invested) }}</strong>
              </div>
              <div class="card-row">
                <span>Disponible</span>
                <strong>{{ formatCurrency(account.total_available) }}</strong>
              </div>
              <div class="card-row">
                <span>Ganancias</span>
                <strong [class.positive]="account.total_gains >= 0" [class.negative]="account.total_gains < 0">
                  {{ formatCurrency(account.total_gains) }}
                </strong>
              </div>
            </div>
            <button class="btn-detail" (click)="viewAccount(account)">Ver detalle →</button>
          </div>
        </div>

        <div class="empty-state" *ngIf="accounts.length === 0 && !loading">
          <p>No hay terceros registrados</p>
          <button class="btn-primary" (click)="openAccountModal()">Crear primer tercero</button>
        </div>
      </div>

      <!-- Detail View -->
      <div *ngIf="selectedAccount !== null">
        <div class="detail-header">
          <button class="btn-back" (click)="selectedAccount = null; movements = []; movementsByType = []">← Volver</button>
          <div class="detail-info">
            <h2>{{ selectedAccount.person_name }}</h2>
          </div>
          <button class="btn-primary" (click)="openMovementModal()">+ Nuevo Movimiento</button>
        </div>

        <div class="summary-bar">
          <div class="summary-item">
            <span>Aportado</span>
            <strong>{{ formatCurrency(selectedAccount.total_contributed) }}</strong>
          </div>
          <div class="summary-item">
            <span>Invertido</span>
            <strong>{{ formatCurrency(selectedAccount.total_invested) }}</strong>
          </div>
          <div class="summary-item">
            <span>Disponible</span>
            <strong>{{ formatCurrency(selectedAccount.total_available) }}</strong>
          </div>
          <div class="summary-item">
            <span>Ganancias</span>
            <strong [class.positive]="selectedAccount.total_gains >= 0" [class.negative]="selectedAccount.total_gains < 0">
              {{ formatCurrency(selectedAccount.total_gains) }}
            </strong>
          </div>
        </div>

        <div class="summary-bar" *ngIf="movementsByType.length > 0">
          <div class="summary-item" *ngFor="let m of movementsByType">
            <span class="movement-type-label">
              <span class="type-badge" [class]="'type-' + m.type">{{ getMovementTypeLabel(m.type) }}</span>
            </span>
            <strong>{{ formatCurrency(m.total) }}</strong>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Descripción</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let mov of movements">
                <td>{{ formatDate(mov.date) }}</td>
                <td>
                  <span class="type-badge" [class]="'type-' + mov.type">{{ getMovementTypeLabel(mov.type) }}</span>
                </td>
                <td>{{ mov.description || '-' }}</td>
                <td class="amount-cell" [class.positive]="isPositive(mov.type)" [class.negative]="isNegative(mov.type)">
                  {{ formatCurrency(mov.amount) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" *ngIf="movements.length === 0 && !loadingDetail">
          <p>No hay movimientos registrados</p>
          <button class="btn-primary" (click)="openMovementModal()">Registrar primer movimiento</button>
        </div>
      </div>

      <!-- Account Modal -->
      <div class="modal-overlay" *ngIf="showAccountModal" (click)="closeAccountModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingAccountId ? 'Editar Tercero' : 'Nuevo Tercero' }}</h2>
            <button class="btn-close" (click)="closeAccountModal()">&times;</button>
          </div>
          <form [formGroup]="accountForm" (ngSubmit)="onSubmitAccount()">
            <div class="form-group">
              <label for="person_name">Nombre de la persona</label>
              <input id="person_name" formControlName="person_name" placeholder="Ej: Juan Pérez" />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeAccountModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="accountForm.invalid || saving">
                {{ saving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Movement Modal -->
      <div class="modal-overlay" *ngIf="showMovementModal" (click)="closeMovementModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Nuevo Movimiento</h2>
            <button class="btn-close" (click)="closeMovementModal()">&times;</button>
          </div>
          <form [formGroup]="movementForm" (ngSubmit)="onSubmitMovement()">
            <div class="form-group">
              <label for="mov-type">Tipo</label>
              <select id="mov-type" formControlName="type">
                <option value="">Seleccionar tipo</option>
                <option value="deposit">Depósito</option>
                <option value="withdrawal">Retiro</option>
                <option value="investment_buy">Compra de Inversión</option>
                <option value="investment_sell">Venta de Inversión</option>
                <option value="transfer">Transferencia</option>
              </select>
            </div>
            <div class="form-group">
              <label for="mov-amount">Monto</label>
              <app-currency-input id="mov-amount" formControlName="amount" placeholder="0" />
            </div>
            <div class="form-group">
              <label for="mov-date">Fecha</label>
              <input id="mov-date" type="date" formControlName="date" />
            </div>
            <div class="form-group">
              <label for="mov-description">Descripción (opcional)</label>
              <input id="mov-description" formControlName="description" placeholder="Descripción del movimiento..." />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeMovementModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="movementForm.invalid || saving">
                {{ saving ? 'Guardando...' : 'Registrar' }}
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
    .summary-bar {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      background: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      flex-wrap: wrap;
    }
    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .summary-item span {
      font-size: 0.85rem;
      color: #888;
    }
    .summary-item strong {
      font-size: 1.1rem;
      color: #333;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .card-header h3 { margin: 0; color: #333; }
    .card-actions { display: flex; gap: 4px; }
    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      padding: 4px;
      border-radius: 4px;
    }
    .btn-icon:hover { background: #f0f0f0; }
    .card-values {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }
    .card-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-row span {
      font-size: 0.9rem;
      color: #888;
    }
    .card-row strong {
      font-size: 1rem;
      color: #333;
    }
    .btn-detail {
      width: 100%;
      background: #f5f5f5;
      color: #333;
      border: none;
      padding: 10px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.9rem;
      transition: background 0.2s;
    }
    .btn-detail:hover { background: #e8e8e8; }
    .positive { color: #4caf50 !important; }
    .negative { color: #e53935 !important; }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
      background: white;
      border-radius: 8px;
    }
    .detail-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .btn-back {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      color: #4caf50;
      font-weight: 500;
      padding: 4px 0;
    }
    .btn-back:hover { text-decoration: underline; }
    .detail-info {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }
    .detail-info h2 { margin: 0; color: #333; }
    .type-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .type-deposit { background: #e8f5e9; color: #2e7d32; }
    .type-withdrawal { background: #ffebee; color: #c62828; }
    .type-investment_buy { background: #e3f2fd; color: #1565c0; }
    .type-investment_sell { background: #f3e5f5; color: #7b1fa2; }
    .type-transfer { background: #fff3e0; color: #e65100; }
    .movement-type-label {
      display: inline-flex;
      align-items: center;
    }
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
    .amount-cell { font-weight: 600; }
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
export class ThirdPartyComponent implements OnInit {
  accounts: any[] = [];
  selectedAccount: any = null;
  movements: any[] = [];
  movementsByType: any[] = [];
  loading = false;
  loadingDetail = false;
  saving = false;
  showAccountModal = false;
  showMovementModal = false;
  editingAccountId: number | null = null;
  accountForm: FormGroup;
  movementForm: FormGroup;

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.accountForm = this.fb.group({
      person_name: ['', [Validators.required, Validators.maxLength(100)]],
    });
    this.movementForm = this.fb.group({
      type: ['', [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      date: [new Date().toISOString().split('T')[0], [Validators.required]],
      description: [''],
    });
  }

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.loading = true;
    this.api.get<any>('/third-party').subscribe({
      next: (res) => { this.accounts = res.data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  viewAccount(account: any): void {
    this.loadingDetail = true;
    this.api.get<any>(`/third-party/${account.id}/summary`).subscribe({
      next: (res) => {
        this.selectedAccount = res.data.account;
        this.movementsByType = res.data.movementsByType || [];
        this.loadingDetail = false;
      },
      error: () => { this.loadingDetail = false; },
    });
    this.api.get<any>(`/third-party/${account.id}`).subscribe({
      next: (res) => { this.movements = res.data.movements || []; },
      error: () => {},
    });
  }

  getTotalContributed(): number {
    return this.accounts.reduce((sum: number, a: any) => sum + Number(a.total_contributed || 0), 0);
  }

  getTotalInvested(): number {
    return this.accounts.reduce((sum: number, a: any) => sum + Number(a.total_invested || 0), 0);
  }

  getTotalAvailable(): number {
    return this.accounts.reduce((sum: number, a: any) => sum + Number(a.total_available || 0), 0);
  }

  getTotalGains(): number {
    return this.accounts.reduce((sum: number, a: any) => sum + Number(a.total_gains || 0), 0);
  }

  openAccountModal(): void {
    this.editingAccountId = null;
    this.accountForm.reset({ person_name: '' });
    this.showAccountModal = true;
  }

  closeAccountModal(): void {
    this.showAccountModal = false;
    this.editingAccountId = null;
  }

  editAccount(account: any, event: Event): void {
    event.stopPropagation();
    this.editingAccountId = account.id;
    this.accountForm.patchValue({ person_name: account.person_name });
    this.showAccountModal = true;
  }

  onSubmitAccount(): void {
    if (this.accountForm.invalid) return;
    this.saving = true;
    const request = this.editingAccountId
      ? this.api.put(`/third-party/${this.editingAccountId}`, this.accountForm.value)
      : this.api.post('/third-party', this.accountForm.value);
    request.subscribe({
      next: () => {
        this.loadAccounts();
        this.closeAccountModal();
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  deleteAccount(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('¿Eliminar este tercero y todos sus movimientos?')) return;
    this.api.delete(`/third-party/${id}`).subscribe({
      next: () => {
        if (this.selectedAccount?.id === id) {
          this.selectedAccount = null;
          this.movements = [];
          this.movementsByType = [];
        }
        this.loadAccounts();
      },
    });
  }

  openMovementModal(): void {
    this.movementForm.reset({
      type: '',
      amount: null,
      date: new Date().toISOString().split('T')[0],
      description: '',
    });
    this.showMovementModal = true;
  }

  closeMovementModal(): void {
    this.showMovementModal = false;
  }

  onSubmitMovement(): void {
    if (this.movementForm.invalid || !this.selectedAccount) return;
    this.saving = true;
    this.api.post(`/third-party/${this.selectedAccount.id}/movements`, this.movementForm.value).subscribe({
      next: () => {
        this.viewAccount(this.selectedAccount);
        this.loadAccounts();
        this.closeMovementModal();
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  getMovementTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      deposit: 'Depósito',
      withdrawal: 'Retiro',
      investment_buy: 'Compra Inv.',
      investment_sell: 'Venta Inv.',
      transfer: 'Transferencia',
    };
    return labels[type] || type;
  }

  isPositive(type: string): boolean {
    return type === 'deposit' || type === 'investment_sell';
  }

  isNegative(type: string): boolean {
    return type === 'withdrawal' || type === 'investment_buy';
  }

  formatDate(date: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-CO');
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  }
}
