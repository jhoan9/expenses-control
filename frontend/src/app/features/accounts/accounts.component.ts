import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';

@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyInputComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Cuentas</h1>
        <button class="btn-primary" (click)="openModal()">+ Nueva Cuenta</button>
      </div>

      <div class="cards-grid">
        <div class="account-card" *ngFor="let account of accounts" [class.card-credit]="account.type === 'credit_card'">
          <div class="account-header">
            <span class="account-icon">{{ getAccountIcon(account.type) }}</span>
            <div class="account-actions">
              <button class="btn-icon" (click)="editAccount(account)">✏️</button>
              <button class="btn-icon" (click)="deleteAccount(account.id)">🗑️</button>
            </div>
          </div>
          <h3>{{ account.name }}</h3>
          <p class="account-type">{{ getAccountTypeLabel(account.type) }}</p>
          <p class="account-balance" [class.debt]="account.type === 'credit_card'">
            {{ account.type === 'credit_card' ? 'Debe: ' + formatCurrency(account.balance) : formatCurrency(account.balance) }}
          </p>
          <p class="account-available" *ngIf="account.type === 'credit_card' && availableCredit(account) > 0">
            Disponible: {{ formatCurrency(availableCredit(account)) }} de {{ formatCurrency(account.credit_limit) }}
          </p>
          <div class="account-actions-row">
            <button class="btn-action" (click)="openMovements(account)">📋 Movimientos</button>
            <button class="btn-action" (click)="openTransfer(account)">⇄ Transferir</button>
            <button class="btn-action btn-card" *ngIf="account.type === 'credit_card'" (click)="openAbono(account)">💳 Pagar Tarjeta</button>
          </div>
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
                <option value="credit_card">Tarjeta de Crédito</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div class="form-group">
              <label for="balance">{{ editingId ? 'Saldo Actual' : (form.value.type === 'credit_card' ? 'Deuda Actual' : 'Saldo Inicial') }}</label>
              <app-currency-input id="balance" formControlName="balance" placeholder="0" />
            </div>

            <div class="form-group" *ngIf="form.value.type === 'credit_card'">
              <label for="credit_limit">Cupo de la Tarjeta</label>
              <app-currency-input id="credit_limit" formControlName="credit_limit" placeholder="0" />
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

      <!-- Movements Modal -->
      <div class="modal-overlay" *ngIf="showMovementsModal" (click)="closeMovementsModal()">
        <div class="modal modal-wide" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Movimientos - {{ movementsAccountName }}</h2>
            <button class="btn-close" (click)="closeMovementsModal()">&times;</button>
          </div>
          <div class="modal-body">
            <div class="movements-list" *ngIf="movements.length > 0; else noMovements">
              <div class="movement-item" *ngFor="let mov of movements" [class.movement-income]="isIncomeType(mov.type)" [class.movement-expense]="isExpenseType(mov.type)">
                <div class="movement-info">
                  <span class="movement-type-badge" [class]="'type-' + mov.type">{{ getTypeLabel(mov.type) }}</span>
                  <span class="movement-desc">{{ mov.description || 'Sin descripción' }}</span>
                  <small class="movement-date">{{ mov.created_at | date:'dd/MM/yy HH:mm' }}</small>
                </div>
                <div class="movement-amounts">
                  <span class="movement-amount" [class.positive]="isIncomeType(mov.type)" [class.negative]="isExpenseType(mov.type)">
                    {{ isIncomeType(mov.type) ? '+' : '-' }}{{ formatCurrency(mov.amount) }}
                  </span>
                  <small class="movement-balance">Saldo: {{ formatCurrency(mov.balance_after) }}</small>
                </div>
              </div>
            </div>
            <ng-template #noMovements>
              <p class="no-data">No hay movimientos en esta cuenta</p>
            </ng-template>
          </div>
        </div>
      </div>

      <!-- Transfer Modal -->
      <div class="modal-overlay" *ngIf="showTransferModal" (click)="closeTransferModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Transferir desde {{ transferFromName }}</h2>
            <button class="btn-close" (click)="closeTransferModal()">&times;</button>
          </div>

          <form [formGroup]="transferForm" (ngSubmit)="submitTransfer()">
            <div class="form-group">
              <label for="to-account">Cuenta Destino</label>
              <select id="to-account" formControlName="to_account_id">
                <option value="">Seleccionar cuenta</option>
                <option *ngFor="let acc of transferTargets" [value]="acc.id">{{ acc.name }}</option>
              </select>
            </div>

            <div class="form-group">
              <label for="transfer-amount">Valor a Enviar</label>
              <app-currency-input id="transfer-amount" formControlName="amount" placeholder="0" />
            </div>

            <div class="form-group tax-box">
              <label class="checkbox-label">
                <input type="checkbox" formControlName="applies_four_x_thousand" />
                <span>Aplicar 4x1000</span>
              </label>
              <div class="tax-preview" *ngIf="fourXThousandTax > 0">
                <span>Impuesto 4x1000: {{ formatCurrency(fourXThousandTax) }}</span>
                <span class="tax-total">Total a debitar: {{ formatCurrency(fourXThousandTax + transferAmount) }}</span>
              </div>
            </div>

            <div class="form-group">
              <label for="transfer-desc">Descripción</label>
              <input id="transfer-desc" formControlName="description" placeholder="Opcional" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeTransferModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="transferForm.invalid || saving">
                {{ saving ? 'Procesando...' : 'Transferir' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Credit Card Payment Modal -->
      <div class="modal-overlay" *ngIf="showAbonoModal" (click)="closeAbonoModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Abono a {{ abonoCardName }}</h2>
            <button class="btn-close" (click)="closeAbonoModal()">&times;</button>
          </div>

          <form [formGroup]="abonoForm" (ngSubmit)="submitAbono()">
            <div class="form-group">
              <label for="abono-from">Desde la Cuenta</label>
              <select id="abono-from" formControlName="from_account_id">
                <option value="">Seleccionar cuenta</option>
                <option *ngFor="let acc of abonoSources" [value]="acc.id">{{ acc.name }} ({{ formatCurrency(acc.balance) }})</option>
              </select>
            </div>

            <div class="form-group">
              <label for="abono-amount">Valor del Abono</label>
              <app-currency-input id="abono-amount" formControlName="amount" placeholder="0" />
            </div>

            <div class="form-group">
              <label for="abono-desc">Descripción</label>
              <input id="abono-desc" formControlName="description" placeholder="Opcional" />
            </div>

            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeAbonoModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="abonoForm.invalid || saving">
                {{ saving ? 'Procesando...' : 'Realizar Abono' }}
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
    .account-balance.debt { color: #e53935; }
    .account-available {
      font-size: 0.9rem;
      color: #2e7d32;
      margin: 4px 0 0;
      font-weight: 500;
    }
    .account-actions-row {
      display: flex;
      gap: 8px;
      margin-top: 14px;
    }
    .btn-action {
      flex: 1;
      background: #f0f4ff;
      color: #1565c0;
      border: 1px solid #d0ddf5;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.85rem;
    }
    .btn-action:hover { background: #e3ecff; }
    .btn-action.btn-card { background: #fff3e0; color: #e65100; border-color: #ffe0b2; }
    .btn-action.btn-card:hover { background: #ffe8cc; }
    .card-credit { border-left: 4px solid #ff9800; }
    .tax-box {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 12px 16px;
    }
    .tax-preview {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 8px;
      font-size: 0.85rem;
      color: #666;
    }
    .tax-preview .tax-total { font-weight: 600; color: #333; }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      color: #333;
      cursor: pointer;
      margin: 0;
    }
    .checkbox-label input[type="checkbox"] { width: auto; }
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
    .modal-wide { max-width: 600px; }
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
    .modal-body {
      padding: 16px 20px;
      max-height: 60vh;
      overflow-y: auto;
    }
    .movements-list { display: flex; flex-direction: column; gap: 8px; }
    .movement-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px;
      background: #fafafa;
      border-radius: 8px;
      border-left: 3px solid #ddd;
    }
    .movement-item.movement-income { border-left-color: #4caf50; }
    .movement-item.movement-expense { border-left-color: #e53935; }
    .movement-info { display: flex; flex-direction: column; gap: 2px; }
    .movement-type-badge {
      font-size: 0.7rem;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 4px;
      width: fit-content;
    }
    .type-income, .type-investment_sell, .type-transfer_in { background: #e8f5e9; color: #2e7d32; }
    .type-expense, .type-investment_buy, .type-credit_card_payment { background: #ffebee; color: #c62828; }
    .type-credit_payment { background: #e3f2fd; color: #1565c0; }
    .type-transfer { background: #f3e5f5; color: #7b1fa2; }
    .movement-desc { font-size: 0.85rem; color: #555; }
    .movement-date { font-size: 0.75rem; color: #999; }
    .movement-amounts { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .movement-amount { font-weight: 600; font-size: 0.95rem; }
    .movement-amount.positive { color: #4caf50; }
    .movement-amount.negative { color: #e53935; }
    .movement-balance { font-size: 0.75rem; color: #999; }
    .no-data { color: #888; text-align: center; padding: 20px; }
  `]
})
export class AccountsComponent implements OnInit {
  accounts: any[] = [];
  loading = false;
  showModal = false;
  editingId: number | null = null;
  originalType: string = '';
  saving = false;
  form: FormGroup;

  showTransferModal = false;
  transferFromId: number | null = null;
  transferFromName = '';
  transferForm: FormGroup;

  showAbonoModal = false;
  abonoCardId: number | null = null;
  abonoCardName = '';
  abonoForm: FormGroup;

  showMovementsModal = false;
  movementsAccountId: number | null = null;
  movementsAccountName = '';
  movements: any[] = [];

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      type: ['', [Validators.required]],
      balance: [0, [Validators.required]],
      credit_limit: [0],
    });
    this.transferForm = this.fb.group({
      to_account_id: [null, [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      applies_four_x_thousand: [false],
      description: [''],
    });
    this.abonoForm = this.fb.group({
      from_account_id: [null, [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      description: [''],
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

  get transferTargets(): any[] {
    return this.accounts.filter(a => a.id !== this.transferFromId);
  }

  get abonoSources(): any[] {
    return this.accounts.filter(a => a.id !== this.abonoCardId && a.type !== 'credit_card');
  }

  get transferAmount(): number {
    return Number(this.transferForm.value.amount) || 0;
  }

  get fourXThousandTax(): number {
    if (!this.transferForm.value.applies_four_x_thousand) return 0;
    return Math.round(this.transferAmount * 0.004 * 100) / 100;
  }

  openTransfer(account: any): void {
    this.transferFromId = account.id;
    this.transferFromName = account.name;
    this.transferForm.reset({
      to_account_id: null,
      amount: null,
      applies_four_x_thousand: false,
      description: '',
    });
    this.showTransferModal = true;
  }

  closeTransferModal(): void {
    this.showTransferModal = false;
    this.transferFromId = null;
  }

  submitTransfer(): void {
    if (this.transferForm.invalid) return;
    this.saving = true;
    this.api.post(`/accounts/${this.transferFromId}/transfer`, this.transferForm.value).subscribe({
      next: () => { this.loadAccounts(); this.closeTransferModal(); this.saving = false; },
      error: () => { this.saving = false; },
    });
  }

  openAbono(account: any): void {
    this.abonoCardId = account.id;
    this.abonoCardName = account.name;
    this.abonoForm.reset({ from_account_id: null, amount: null, description: '' });
    this.showAbonoModal = true;
  }

  closeAbonoModal(): void {
    this.showAbonoModal = false;
    this.abonoCardId = null;
  }

  submitAbono(): void {
    if (this.abonoForm.invalid) return;
    this.saving = true;
    this.api.post(`/accounts/${this.abonoCardId}/abono`, this.abonoForm.value).subscribe({
      next: () => { this.loadAccounts(); this.closeAbonoModal(); this.saving = false; },
      error: () => { this.saving = false; },
    });
  }

  openModal(): void {
    this.editingId = null;
    this.form.reset({ name: '', type: '', balance: 0, credit_limit: 0 });
    this.form.get('balance')?.enable();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingId = null;
    this.form.get('balance')?.enable();
  }

  editAccount(account: any): void {
    this.editingId = account.id;
    this.originalType = account.type;
    this.form.get('balance')?.enable();
    this.form.patchValue({ name: account.name, type: account.type, balance: account.balance, credit_limit: account.credit_limit || 0 });
    this.form.get('balance')?.disable();
    this.showModal = true;
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.saving = true;

    const formValue = { ...this.form.value };
    if (this.form.get('balance')?.disabled) {
      formValue.balance = this.form.get('balance')?.value;
    }

    const request = this.editingId
      ? this.api.put(`/accounts/${this.editingId}`, formValue)
      : this.api.post('/accounts', formValue);

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
    const icons: Record<string, string> = { savings: '🏦', checking: '💳', cash: '💵', investment: '📈', credit_card: '💳', other: '💰' };
    return icons[type] || '💰';
  }

  getAccountTypeLabel(type: string): string {
    const labels: Record<string, string> = { savings: 'Ahorros', checking: 'Corriente', cash: 'Efectivo', investment: 'Inversión', credit_card: 'Tarjeta de Crédito', other: 'Otro' };
    return labels[type] || type;
  }

  availableCredit(account: any): number {
    return (Number(account.credit_limit) || 0) - (Number(account.balance) || 0);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value);
  }

  openMovements(account: any): void {
    this.movementsAccountId = account.id;
    this.movementsAccountName = account.name;
    this.movements = [];
    this.showMovementsModal = true;
    this.api.get<any>(`/accounts/${account.id}/movements`).subscribe({
      next: (res) => { this.movements = res.data; },
      error: () => { this.movements = []; },
    });
  }

  closeMovementsModal(): void {
    this.showMovementsModal = false;
    this.movementsAccountId = null;
  }

  isIncomeType(type: string): boolean {
    return ['income', 'investment_sell', 'credit_payment'].includes(type);
  }

  isExpenseType(type: string): boolean {
    return ['expense', 'investment_buy', 'credit_card_payment'].includes(type);
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      income: 'Ingreso', expense: 'Gasto', transfer: 'Transferencia',
      investment_buy: 'Compra Inv.', investment_sell: 'Venta Inv.',
      credit_payment: 'Abono TC', credit_card_payment: 'Pago TC'
    };
    return labels[type] || type;
  }
}
