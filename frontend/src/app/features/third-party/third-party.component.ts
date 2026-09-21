import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { formatCurrency, todayLocal, formatDate as formatDateUtil } from '../../shared/utils/format';

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
  `
})
export class ThirdPartyComponent implements OnInit {
  formatCurrency = formatCurrency;
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
      amount: [null, [Validators.required, Validators.min(0.00000001)]],
      date: [todayLocal(), [Validators.required]],
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
      date: todayLocal(),
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
    return formatDateUtil(date);
  }

}
