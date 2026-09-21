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

        <div class="pagination" *ngIf="paymentTotalPages > 1">
          <span class="page-info">
            Mostrando {{ paymentPageFirst }}–{{ paymentPageLast }} de {{ paymentTotal }} · Página {{ paymentPage }} de {{ paymentTotalPages }}
          </span>
          <div class="page-buttons">
            <button class="btn-mini" (click)="loadPayments(paymentPage - 1)" [disabled]="paymentPage <= 1">← Anterior</button>
            <button class="btn-mini page-num" *ngFor="let p of paymentPageNumbers" [class.active]="p === paymentPage" (click)="loadPayments(p)">{{ p }}</button>
            <button class="btn-mini" (click)="loadPayments(paymentPage + 1)" [disabled]="paymentPage >= paymentTotalPages">Siguiente →</button>
          </div>
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
  `
})
export class CreditsComponent implements OnInit {
  formatCurrency = formatCurrency;
  credits: any[] = [];
  summary: any = null;
  selectedCredit: any = null;
  creditDetail: any = null;
  payments: any[] = [];
  paymentPage = 1;
  paymentPageSize = 20;
  paymentTotal = 0;
  paymentTotalPages = 1;
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
      amount: [null, [Validators.required, Validators.min(0.00000001)]],
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

  viewCredit(credit: any, page: number = 1): void {
    this.selectedCredit = credit;
    this.loadingDetail = true;
    this.loadPayments(page);
  }

  loadPayments(page: number): void {
    if (!this.selectedCredit) return;
    const target = Math.max(1, Math.min(page, this.paymentTotalPages));
    this.paymentPage = target;
    this.loadingDetail = true;
    this.api.get<any>(`/credits/${this.selectedCredit.id}`, { page: this.paymentPage, limit: this.paymentPageSize }).subscribe({
      next: (res) => {
        this.creditDetail = res.data;
        this.payments = res.data.payments || [];
        this.paymentTotal = res.data.paymentTotal ?? this.payments.length;
        this.paymentTotalPages = Math.max(1, res.data.paymentTotalPages ?? 1);
        this.selectedCredit.balance = res.data.balance ?? this.selectedCredit.balance;
        this.selectedCredit.credit_limit = res.data.credit_limit ?? this.selectedCredit.credit_limit;
        if (this.payments.length === 0 && this.paymentTotal > 0 && this.paymentPage > this.paymentTotalPages) {
          this.loadPayments(this.paymentTotalPages);
          return;
        }
        this.loadingDetail = false;
      },
      error: () => { this.loadingDetail = false; },
    });
  }

  get paymentPageFirst(): number {
    return this.paymentTotal === 0 ? 0 : (this.paymentPage - 1) * this.paymentPageSize + 1;
  }

  get paymentPageLast(): number {
    return Math.min(this.paymentPage * this.paymentPageSize, this.paymentTotal);
  }

  get paymentPageNumbers(): number[] {
    const total = this.paymentTotalPages;
    const current = this.paymentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const start = Math.max(1, Math.min(current - 2, total - 4));
    return Array.from({ length: 5 }, (_, i) => start + i);
  }

  goBack(): void {
    this.selectedCredit = null;
    this.creditDetail = null;
    this.payments = [];
    this.paymentPage = 1;
    this.paymentTotal = 0;
    this.paymentTotalPages = 1;
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
        this.loadPayments(1);
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
        this.loadPayments(this.paymentPage);
        this.loadSummary();
        this.loadCredits();
      },
    });
  }

  formatDate(date: string): string {
    return formatDateUtil(date);
  }

}
