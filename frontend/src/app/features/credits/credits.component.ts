import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { formatCurrency, todayLocal, formatDate as formatDateUtil } from '../../shared/utils/format';

@Component({
  selector: 'app-credits',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyInputComponent],
  template: `
    <div class="page">
      <!-- List View -->
      <div *ngIf="selectedCredit === null">
        <div class="page-header">
          <h1>Créditos</h1>
          <button class="btn-primary" (click)="openCreditModal()">+ Nuevo Crédito</button>
        </div>

        <div class="summary-bar" *ngIf="summary">
          <div class="summary-item">
            <span>Total Créditos</span>
            <strong>{{ summary.total_credits }}</strong>
          </div>
          <div class="summary-item">
            <span>Límite Total</span>
            <strong>{{ formatCurrency(summary.total_limit) }}</strong>
          </div>
          <div class="summary-item">
            <span>Saldo Total</span>
            <strong [class.negative]="summary.total_balance > 0">
              {{ formatCurrency(summary.total_balance) }}
            </strong>
          </div>
          <div class="summary-item">
            <span>Disponible Total</span>
            <strong class="positive">{{ formatCurrency(summary.total_available) }}</strong>
          </div>
        </div>

        <div class="cards-grid">
          <div class="credit-card" *ngFor="let credit of credits" (click)="viewCredit(credit)">
            <div class="card-header">
              <h3>{{ credit.institution }}</h3>
              <button class="btn-icon btn-danger-icon" (click)="deleteCredit(credit.id, $event)" title="Eliminar">🗑️</button>
            </div>
            <div class="card-values">
              <div class="card-row">
                <span>Límite</span>
                <strong>{{ formatCurrency(credit.credit_limit) }}</strong>
              </div>
              <div class="card-row">
                <span>Saldo</span>
                <strong class="negative">{{ formatCurrency(credit.balance) }}</strong>
              </div>
              <div class="card-row">
                <span>Disponible</span>
                <strong class="positive">{{ formatCurrency(credit.credit_limit - credit.balance) }}</strong>
              </div>
              <div class="card-row" *ngIf="credit.due_date">
                <span>Fecha de pago</span>
                <strong>{{ formatDate(credit.due_date) }}</strong>
              </div>
            </div>
            <div class="usage-container">
              <div class="usage-bar">
                <div class="usage-fill" [style.width.%]="getUsagePercent(credit)" [style.background]="getUsageColor(credit)"></div>
              </div>
              <span class="usage-text">{{ getUsagePercent(credit) | number:'1.0-0' }}% usado</span>
            </div>
            <button class="btn-detail" (click)="viewCredit(credit)">Ver detalle →</button>
          </div>
        </div>

        <div class="empty-state" *ngIf="credits.length === 0 && !loading">
          <p>No hay créditos registrados</p>
          <button class="btn-primary" (click)="openCreditModal()">Crear primer crédito</button>
        </div>
      </div>

      <!-- Detail View -->
      <div *ngIf="selectedCredit !== null">
        <div class="detail-header">
          <button class="btn-back" (click)="goBack()">← Volver</button>
          <div class="detail-info">
            <h2>{{ selectedCredit.institution }}</h2>
          </div>
          <div class="detail-actions">
            <button class="btn-secondary" (click)="openCreditModal()">Editar</button>
            <button class="btn-primary" (click)="openPaymentModal()">+ Abono</button>
          </div>
        </div>

        <div class="summary-bar">
          <div class="summary-item">
            <span>Límite</span>
            <strong>{{ formatCurrency(selectedCredit.credit_limit) }}</strong>
          </div>
          <div class="summary-item">
            <span>Saldo</span>
            <strong class="negative">{{ formatCurrency(selectedCredit.balance) }}</strong>
          </div>
          <div class="summary-item">
            <span>Disponible</span>
            <strong class="positive">{{ formatCurrency(creditDetail?.available_credit || 0) }}</strong>
          </div>
          <div class="summary-item" *ngIf="selectedCredit.due_date">
            <span>Fecha de pago</span>
            <strong>{{ formatDate(selectedCredit.due_date) }}</strong>
          </div>
        </div>

        <div class="usage-container usage-container-detail">
          <div class="usage-bar">
            <div class="usage-fill" [style.width.%]="getUsagePercent(selectedCredit)" [style.background]="getUsageColor(selectedCredit)"></div>
          </div>
          <span class="usage-text">{{ getUsagePercent(selectedCredit) | number:'1.0-0' }}% usado</span>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Monto</th>
                <th>Pago Mínimo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let payment of payments">
                <td>{{ formatDate(payment.date) }}</td>
                <td class="amount-cell negative">{{ formatCurrency(payment.amount) }}</td>
                <td>{{ payment.minimum_payment ? formatCurrency(payment.minimum_payment) : '-' }}</td>
                <td class="actions-cell">
                  <button class="btn-icon btn-danger-icon" (click)="deletePayment(payment)" title="Eliminar abono">🗑️</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" *ngIf="payments.length === 0 && !loadingDetail">
          <p>No hay abonos registrados</p>
          <button class="btn-primary" (click)="openPaymentModal()">Registrar primer abono</button>
        </div>
      </div>

      <!-- Credit Modal -->
      <div class="modal-overlay" *ngIf="showCreditModal" (click)="closeCreditModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingCreditId ? 'Editar Crédito' : 'Nuevo Crédito' }}</h2>
            <button class="btn-close" (click)="closeCreditModal()">&times;</button>
          </div>
          <form [formGroup]="creditForm" (ngSubmit)="onSubmitCredit()">
            <div class="form-group">
              <label for="institution">Institución</label>
              <input id="institution" formControlName="institution" placeholder="Ej: Bancolombia" />
            </div>
            <div class="form-group">
              <label for="credit_limit">Límite de crédito</label>
              <app-currency-input id="credit_limit" formControlName="credit_limit" placeholder="0" />
            </div>
            <div class="form-group">
              <label for="balance">Saldo actual</label>
              <app-currency-input id="balance" formControlName="balance" placeholder="0" />
            </div>
            <div class="form-group">
              <label for="due_date">Fecha de pago (opcional)</label>
              <input id="due_date" type="date" formControlName="due_date" />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeCreditModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="creditForm.invalid || saving">
                {{ saving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Payment Modal -->
      <div class="modal-overlay" *ngIf="showPaymentModal" (click)="closePaymentModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>Nuevo Abono</h2>
            <button class="btn-close" (click)="closePaymentModal()">&times;</button>
          </div>
          <div class="modal-body-info" *ngIf="selectedCredit">
            <span>Saldo actual: <strong class="negative">{{ formatCurrency(selectedCredit.balance) }}</strong></span>
            <span class="separator">→</span>
            <span>Nuevo saldo: <strong [class.negative]="getNewBalance() > 0" [class]="getNewBalance() <= 0 ? 'positive' : ''">
              {{ formatCurrency(getNewBalance()) }}
            </strong></span>
          </div>
          <form [formGroup]="paymentForm" (ngSubmit)="onSubmitPayment()">
            <div class="form-group">
              <label for="pay-amount">Monto</label>
              <app-currency-input id="pay-amount" formControlName="amount" placeholder="0" />
            </div>
            <div class="form-group">
              <label for="pay-minimum">Pago mínimo (opcional)</label>
              <app-currency-input id="pay-minimum" formControlName="minimum_payment" placeholder="0" />
            </div>
            <div class="form-group">
              <label for="pay-date">Fecha</label>
              <input id="pay-date" type="date" formControlName="date" />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closePaymentModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="paymentForm.invalid || saving">
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
    .credit-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s;
      cursor: pointer;
    }
    .credit-card:hover { transform: translateY(-2px); }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .card-header h3 { margin: 0; color: #333; }
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
    .usage-container {
      margin-bottom: 12px;
    }
    .usage-container-detail {
      margin-bottom: 16px;
      background: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .usage-bar {
      width: 100%;
      height: 10px;
      background: #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .usage-fill {
      height: 100%;
      border-radius: 5px;
      transition: width 0.3s ease, background 0.3s ease;
    }
    .usage-text {
      font-size: 0.8rem;
      color: #888;
    }
    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      padding: 4px;
      border-radius: 4px;
    }
    .btn-icon:hover { background: #f0f0f0; }
    .btn-danger-icon:hover { background: #ffebee; }
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
    .negative { color: #e53935 !important; }
    .positive { color: #4caf50 !important; }
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
    .detail-actions {
      display: flex;
      gap: 8px;
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
    .actions-cell { text-align: right; }
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
    .btn-secondary {
      background: #f5f5f5;
      color: #333;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-secondary:hover { background: #e0e0e0; }
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
    .modal-body-info {
      padding: 12px 20px;
      background: #f5f5f5;
      font-size: 0.95rem;
      color: #555;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .separator { color: #bbb; }
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
  `]
})
export class CreditsComponent implements OnInit {
  formatCurrency = formatCurrency;
  credits: any[] = [];
  summary: any = null;
  selectedCredit: any = null;
  creditDetail: any = null;
  payments: any[] = [];
  loading = false;
  loadingDetail = false;
  saving = false;
  showCreditModal = false;
  showPaymentModal = false;
  editingCreditId: number | null = null;
  creditForm: FormGroup;
  paymentForm: FormGroup;

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.creditForm = this.fb.group({
      institution: ['', [Validators.required, Validators.maxLength(100)]],
      credit_limit: [null, [Validators.required, Validators.min(1)]],
      balance: [0, [Validators.required, Validators.min(0)]],
      due_date: [''],
    });
    this.paymentForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      minimum_payment: [null],
      date: [todayLocal(), [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.loadCredits();
    this.loadSummary();
  }

  loadSummary(): void {
    this.api.get<any>('/credits/summary').subscribe({
      next: (res) => { this.summary = res.data; },
      error: () => {},
    });
  }

  loadCredits(): void {
    this.loading = true;
    this.api.get<any>('/credits').subscribe({
      next: (res) => { this.credits = res.data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  viewCredit(credit: any): void {
    this.selectedCredit = credit;
    this.loadingDetail = true;
    this.api.get<any>(`/credits/${credit.id}`).subscribe({
      next: (res) => {
        this.creditDetail = res.data;
        this.payments = res.data.payments || [];
        this.selectedCredit.balance = res.data.balance ?? credit.balance;
        this.selectedCredit.credit_limit = res.data.credit_limit ?? credit.credit_limit;
        this.loadingDetail = false;
      },
      error: () => { this.loadingDetail = false; },
    });
  }

  goBack(): void {
    this.selectedCredit = null;
    this.creditDetail = null;
    this.payments = [];
    this.loadCredits();
    this.loadSummary();
  }

  getUsagePercent(credit: any): number {
    if (!credit || credit.credit_limit <= 0) return 0;
    return Math.min(100, (credit.balance / credit.credit_limit) * 100);
  }

  getUsageColor(credit: any): string {
    const percent = this.getUsagePercent(credit);
    if (percent < 50) return '#4caf50';
    if (percent < 75) return '#ff9800';
    return '#e53935';
  }

  getNewBalance(): number {
    if (!this.selectedCredit) return 0;
    const amount = this.paymentForm.get('amount')?.value || 0;
    return Math.max(0, this.selectedCredit.balance - amount);
  }

  openCreditModal(): void {
    this.editingCreditId = null;
    this.creditForm.reset({
      institution: '',
      credit_limit: null,
      balance: 0,
      due_date: '',
    });
    if (this.selectedCredit) {
      this.editingCreditId = this.selectedCredit.id;
      this.creditForm.patchValue({
        institution: this.selectedCredit.institution,
        credit_limit: this.selectedCredit.credit_limit,
        balance: this.selectedCredit.balance,
        due_date: this.selectedCredit.due_date || '',
      });
    }
    this.showCreditModal = true;
  }

  closeCreditModal(): void {
    this.showCreditModal = false;
    this.editingCreditId = null;
  }

  onSubmitCredit(): void {
    if (this.creditForm.invalid) return;
    this.saving = true;
    const payload = { ...this.creditForm.value };
    if (!payload.due_date) delete payload.due_date;
    const request = this.editingCreditId
      ? this.api.put(`/credits/${this.editingCreditId}`, payload)
      : this.api.post('/credits', payload);
    request.subscribe({
      next: () => {
        this.loadCredits();
        this.loadSummary();
        if (this.selectedCredit) {
          this.viewCredit(this.selectedCredit);
        }
        this.closeCreditModal();
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  deleteCredit(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('¿Eliminar este crédito y todos sus abonos?')) return;
    this.api.delete(`/credits/${id}`).subscribe({
      next: () => {
        this.loadCredits();
        this.loadSummary();
      },
    });
  }

  openPaymentModal(): void {
    this.paymentForm.reset({
      amount: null,
      minimum_payment: null,
      date: todayLocal(),
    });
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
  }

  onSubmitPayment(): void {
    if (this.paymentForm.invalid || !this.selectedCredit) return;
    this.saving = true;
    const payload: any = {
      amount: this.paymentForm.value.amount,
      date: this.paymentForm.value.date,
    };
    if (this.paymentForm.value.minimum_payment != null) {
      payload.minimum_payment = this.paymentForm.value.minimum_payment;
    }
    this.api.post(`/credits/${this.selectedCredit.id}/payments`, payload).subscribe({
      next: () => {
        this.viewCredit(this.selectedCredit);
        this.loadSummary();
        this.loadCredits();
        this.closePaymentModal();
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  deletePayment(payment: any): void {
    if (!confirm('¿Eliminar este abono?')) return;
    this.api.delete(`/credits/${this.selectedCredit.id}/payments/${payment.id}`).subscribe({
      next: () => {
        this.viewCredit(this.selectedCredit);
        this.loadSummary();
        this.loadCredits();
      },
    });
  }

  formatDate(date: string): string {
    return formatDateUtil(date);
  }

}
