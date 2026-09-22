import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { formatCurrency, todayLocal } from '../../shared/utils/format';
import { ToastService } from '../../core/toast/toast.service';

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
                <option value="bajo_monto">Bajo Monto</option>
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
                  <small class="movement-date">{{ mov.date | date:'dd/MM/yyyy' }}</small>
                </div>
                <div class="movement-amounts">
                  <span class="movement-amount" [class.positive]="isIncomeType(mov.type)" [class.negative]="isExpenseType(mov.type)">
                    {{ isIncomeType(mov.type) ? '+' : '-' }}{{ formatCurrency(mov.amount) }}
                  </span>
                  <small class="movement-balance">Saldo: {{ formatCurrency(mov.balance_after) }}</small>
                </div>
              </div>
            </div>
            <div class="pagination" *ngIf="movementsTotalPages > 1">
              <span class="page-info">
                Mostrando {{ movementsPageFirst }}–{{ movementsPageLast }} de {{ movementsTotal }} · Página {{ movementsPage }} de {{ movementsTotalPages }}
              </span>
              <div class="page-buttons">
                <button class="btn-mini" (click)="loadMovements(movementsPage - 1)" [disabled]="movementsPage <= 1">← Anterior</button>
                <button class="btn-mini page-num" *ngFor="let p of movementsPageNumbers" [class.active]="p === movementsPage" (click)="loadMovements(p)">{{ p }}</button>
                <button class="btn-mini" (click)="loadMovements(movementsPage + 1)" [disabled]="movementsPage >= movementsTotalPages">Siguiente →</button>
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

            <div class="form-group">
              <label for="transfer-date">Fecha de Transferencia</label>
              <input id="transfer-date" type="date" formControlName="date" />
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
  `
})
export class AccountsComponent implements OnInit {
  formatCurrency = formatCurrency;
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
  movementsPage = 1;
  movementsPageSize = 20;
  movementsTotal = 0;
  movementsTotalPages = 1;

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private toast: ToastService
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      type: ['', [Validators.required]],
      balance: [0, [Validators.required]],
      credit_limit: [0],
    });
    this.transferForm = this.fb.group({
      to_account_id: [null, [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.00000001)]],
      date: [todayLocal(), [Validators.required]],
      applies_four_x_thousand: [false],
      description: [''],
    });
    this.abonoForm = this.fb.group({
      from_account_id: [null, [Validators.required]],
      amount: [null, [Validators.required, Validators.min(0.00000001)]],
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
    const decimals = this.isJi01Role ? 100000000 : 100000;
    return Math.round(this.transferAmount * 0.004 * decimals) / decimals;
  }

  get isJi01Role(): boolean {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.role === 'ji01';
    } catch {
      return false;
    }
  }

  openTransfer(account: any): void {
    this.transferFromId = account.id;
    this.transferFromName = account.name;
    this.transferForm.reset({
      to_account_id: null,
      amount: null,
      date: todayLocal(),
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
      next: () => {
        this.loadAccounts();
        this.closeTransferModal();
        this.saving = false;
        this.toast.showSuccess('Transferencia realizada correctamente', 'Éxito');
      },
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
      next: () => {
        this.loadAccounts();
        this.closeAbonoModal();
        this.saving = false;
        this.toast.showSuccess('Abono realizado correctamente', 'Éxito');
      },
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
      next: () => {
        this.loadAccounts();
        this.closeModal();
        this.saving = false;
        this.toast.showSuccess(
          this.editingId ? 'Cuenta actualizada correctamente' : 'Cuenta creada correctamente',
          'Éxito'
        );
      },
      error: () => { this.saving = false; },
    });
  }

  deleteAccount(id: number): void {
    if (!confirm('¿Eliminar esta cuenta?')) return;
    this.api.delete(`/accounts/${id}`).subscribe({
      next: () => {
        this.loadAccounts();
        this.toast.showSuccess('Cuenta eliminada correctamente', 'Éxito');
      },
    });
  }

  getAccountIcon(type: string): string {
    const icons: Record<string, string> = { savings: '🏦', checking: '💳', cash: '💵', investment: '📈', credit_card: '💳', bajo_monto: '💰', other: '💰' };
    return icons[type] || '💰';
  }

  getAccountTypeLabel(type: string): string {
    const labels: Record<string, string> = { savings: 'Ahorros', checking: 'Corriente', cash: 'Efectivo', investment: 'Inversión', credit_card: 'Tarjeta de Crédito', bajo_monto: 'Bajo Monto', other: 'Otro' };
    return labels[type] || type;
  }

  availableCredit(account: any): number {
    return (Number(account.credit_limit) || 0) - (Number(account.balance) || 0);
  }

  openMovements(account: any): void {
    this.movementsAccountId = account.id;
    this.movementsAccountName = account.name;
    this.movements = [];
    this.movementsPage = 1;
    this.movementsTotal = 0;
    this.movementsTotalPages = 1;
    this.showMovementsModal = true;
    this.loadMovements(1);
  }

  loadMovements(page: number): void {
    if (this.movementsAccountId === null) return;
    const target = Math.max(1, Math.min(page, this.movementsTotalPages));
    this.movementsPage = target;
    this.api.get<any>(`/accounts/${this.movementsAccountId}/movements`, { page: this.movementsPage, limit: this.movementsPageSize }).subscribe({
      next: (res) => {
        this.movements = res.data;
        this.movementsTotal = res.pagination?.total ?? 0;
        this.movementsTotalPages = Math.max(1, res.pagination?.totalPages ?? 1);
        if (this.movements.length === 0 && this.movementsTotal > 0 && this.movementsPage > this.movementsTotalPages) {
          this.loadMovements(this.movementsTotalPages);
        }
      },
      error: () => { this.movements = []; },
    });
  }

  get movementsPageFirst(): number {
    return this.movementsTotal === 0 ? 0 : (this.movementsPage - 1) * this.movementsPageSize + 1;
  }

  get movementsPageLast(): number {
    return Math.min(this.movementsPage * this.movementsPageSize, this.movementsTotal);
  }

  get movementsPageNumbers(): number[] {
    const total = this.movementsTotalPages;
    const current = this.movementsPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(current - 2, total - 4));
    return Array.from({ length: 5 }, (_, i) => start + i);
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
