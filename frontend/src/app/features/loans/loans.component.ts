import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { formatCurrency, todayLocal, formatDate as formatDateUtil } from '../../shared/utils/format';

@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyInputComponent],
  template: `
    <div class="page">
      <!-- List View -->
      <div *ngIf="selectedLoan === null">
        <div class="page-header">
          <h1>Préstamos</h1>
          <button class="btn-primary" (click)="openLoanModal()">+ Nuevo Préstamo</button>
        </div>

        <div class="summary-bar" *ngIf="summary">
          <div class="summary-item">
            <span>Total Préstamos</span>
            <strong>{{ summary.total_loans }}</strong>
          </div>
          <div class="summary-item">
            <span>Total Prestado</span>
            <strong>{{ formatCurrency(summary.total_lent) }}</strong>
          </div>
          <div class="summary-item">
            <span>Total Pagado</span>
            <strong>{{ formatCurrency(summary.total_paid) }}</strong>
          </div>
          <div class="summary-item">
            <span>Total Pendiente</span>
            <strong [class.negative]="summary.total_remaining > 0">
              {{ formatCurrency(summary.total_remaining) }}
            </strong>
          </div>
        </div>

        <div *ngIf="groupedLoans.length > 0">
          <div class="person-group" *ngFor="let group of groupedLoans">
            <div class="person-header">
              <div class="person-info">
                <h3>{{ group.borrower_name }}</h3>
                <span class="person-meta">
                  {{ group.loans.length }} préstamo(s) · Total
                  <strong>{{ formatCurrency(group.total) }}</strong> · Pendiente
                  <strong>{{ formatCurrency(group.remaining) }}</strong>
                </span>
              </div>
              <button class="btn-primary-sm" (click)="openLoanModalFor(group.borrower_name)">+ Nuevo préstamo</button>
            </div>
            <div class="cards-grid">
              <div class="loan-card" *ngFor="let loan of group.loans">
                <div class="card-header">
                  <h3>{{ loan.borrower_name }}</h3>
                  <span class="status-badge" [ngClass]="'status-' + loan.status">
                    {{ getStatusLabel(loan.status) }}
                  </span>
                </div>
                <div class="card-values">
                  <div class="card-row">
                    <span>Monto</span>
                    <strong>{{ formatCurrency(loan.amount) }}</strong>
                  </div>
                  <div class="card-row">
                    <span>Pagado</span>
                    <strong>{{ formatCurrency(loan.total_paid || 0) }}</strong>
                  </div>
                  <div class="card-row">
                    <span>Pendiente</span>
                    <strong>{{ formatCurrency(loan.remaining || 0) }}</strong>
                  </div>
                  <div class="card-row">
                    <span>Fecha</span>
                    <strong>{{ formatDate(loan.date) }}</strong>
                  </div>
                  <div class="card-row" *ngIf="loan.description">
                    <span>Descripción</span>
                    <strong class="desc-text">{{ loan.description }}</strong>
                  </div>
                </div>
                <div class="card-actions">
                  <button class="btn-icon" (click)="editLoan(loan, $event)" title="Editar">✏️</button>
                  <button class="btn-icon" (click)="deleteLoan(loan.id, $event)" title="Eliminar">🗑️</button>
                </div>
                <button class="btn-detail" (click)="viewLoan(loan)">Ver detalle →</button>
              </div>
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="loans.length === 0 && !loading">
          <p>No hay préstamos registrados</p>
          <button class="btn-primary" (click)="openLoanModal()">Crear primer préstamo</button>
        </div>
      </div>

      <!-- Detail View -->
      <div *ngIf="selectedLoan !== null">
        <div class="detail-header">
          <button class="btn-back" (click)="goBack()">← Volver</button>
          <div class="detail-info">
            <h2>{{ selectedLoan.borrower_name }}</h2>
            <span class="status-badge" [ngClass]="'status-' + selectedLoan.status">
              {{ getStatusLabel(selectedLoan.status) }}
            </span>
          </div>
          <div class="detail-actions">
            <button class="btn-secondary" (click)="openLoanModal()">Editar</button>
            <button class="btn-primary" (click)="openPaymentModal()" [disabled]="selectedLoan.status === 'paid' || selectedLoan.status === 'cancelled'">
              + Abono
            </button>
          </div>
        </div>

        <div class="summary-bar">
          <div class="summary-item">
            <span>Monto Total</span>
            <strong>{{ formatCurrency(selectedLoan.amount) }}</strong>
          </div>
          <div class="summary-item">
            <span>Total Pagado</span>
            <strong>{{ formatCurrency(loanDetail?.total_paid || 0) }}</strong>
          </div>
          <div class="summary-item">
            <span>Pendiente</span>
            <strong [class.negative]="(loanDetail?.remaining || 0) > 0">
              {{ formatCurrency(loanDetail?.remaining || 0) }}
            </strong>
          </div>
          <div class="summary-item">
            <span>Fecha</span>
            <strong>{{ formatDate(selectedLoan.date) }}</strong>
          </div>
        </div>

        <div class="progress-container" *ngIf="selectedLoan.amount > 0">
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="getProgressPercent()"></div>
          </div>
          <span class="progress-text">{{ getProgressPercent() | number:'1.0-0' }}% pagado</span>
        </div>

        <div class="detail-description" *ngIf="selectedLoan.description">
          <strong>Descripción:</strong> {{ selectedLoan.description }}
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Monto</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let payment of payments">
                <td>{{ formatDate(payment.date) }}</td>
                <td>{{ payment.description || '-' }}</td>
                <td class="amount-cell positive">{{ formatCurrency(payment.amount) }}</td>
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
          <button class="btn-primary" (click)="openPaymentModal()" [disabled]="selectedLoan.status === 'paid' || selectedLoan.status === 'cancelled'">
            Registrar primer abono
          </button>
        </div>
      </div>

      <!-- Loan Modal -->
      <div class="modal-overlay" *ngIf="showLoanModal" (click)="closeLoanModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingLoanId ? 'Editar Préstamo' : 'Nuevo Préstamo' }}</h2>
            <button class="btn-close" (click)="closeLoanModal()">&times;</button>
          </div>
          <form [formGroup]="loanForm" (ngSubmit)="onSubmitLoan()">
            <div class="form-group">
              <label for="borrower_name">Nombre del deudor</label>
              <input id="borrower_name" formControlName="borrower_name" list="existing-borrowers" placeholder="Ej: Juan Pérez" />
              <datalist id="existing-borrowers">
                <option *ngFor="let name of existingBorrowers" [value]="name"></option>
              </datalist>
              <small class="hint" *ngIf="editingLoanId === null">Si la persona ya tiene préstamos, puedes elegirla de la lista para agregar otro a su nombre.</small>
            </div>
            <div class="form-group">
              <label for="amount">Monto</label>
              <app-currency-input id="amount" formControlName="amount" placeholder="0" />
            </div>
            <div class="form-group">
              <label for="date">Fecha</label>
              <input id="date" type="date" formControlName="date" />
            </div>
            <div class="form-group">
              <label for="description">Descripción (opcional)</label>
              <input id="description" formControlName="description" placeholder="Descripción del préstamo..." />
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeLoanModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="loanForm.invalid || saving">
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
          <div class="modal-body-info" *ngIf="selectedLoan && loanDetail">
            <span>Pendiente: <strong>{{ formatCurrency(loanDetail.remaining || 0) }}</strong></span>
          </div>
          <form [formGroup]="paymentForm" (ngSubmit)="onSubmitPayment()">
            <div class="form-group">
              <label for="pay-amount">Monto</label>
              <app-currency-input id="pay-amount" formControlName="amount" placeholder="0" />
            </div>
            <div class="form-group">
              <label for="pay-date">Fecha</label>
              <input id="pay-date" type="date" formControlName="date" />
            </div>
            <div class="form-group">
              <label for="pay-description">Descripción (opcional)</label>
              <input id="pay-description" formControlName="description" placeholder="Descripción del abono..." />
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
export class LoansComponent implements OnInit {
  formatCurrency = formatCurrency;
  loans: any[] = [];
  summary: any = null;
  selectedLoan: any = null;
  loanDetail: any = null;
  payments: any[] = [];
  paymentPage = 1;
  paymentPageSize = 20;
  paymentTotal = 0;
  paymentTotalPages = 1;
  loading = false;
  loadingDetail = false;
  saving = false;
  showLoanModal = false;
  showPaymentModal = false;
  editingLoanId: number | null = null;
  loanForm: FormGroup;
  paymentForm: FormGroup;

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.loanForm = this.fb.group({
      borrower_name: ['', [Validators.required, Validators.maxLength(100)]],
      amount: [null, [Validators.required, Validators.min(0.01)]],
      date: [todayLocal(), [Validators.required]],
      description: [''],
    });
    this.paymentForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(0.01)]],
      date: [todayLocal(), [Validators.required]],
      description: [''],
    });
  }

  ngOnInit(): void {
    this.loadLoans();
    this.loadSummary();
  }

  loadSummary(): void {
    this.api.get<any>('/loans/summary').subscribe({
      next: (res) => { this.summary = res.data; },
      error: () => {},
    });
  }

  loadLoans(): void {
    this.loading = true;
    this.api.get<any>('/loans').subscribe({
      next: (res) => { this.loans = res.data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get existingBorrowers(): string[] {
    const names = new Set<string>();
    for (const loan of this.loans) {
      if (loan.borrower_name) names.add(loan.borrower_name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'es'));
  }

  get groupedLoans(): any[] {
    const map = new Map<string, any[]>();
    for (const loan of this.loans) {
      const name = loan.borrower_name || 'Sin nombre';
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(loan);
    }
    return Array.from(map.entries()).map(([borrower_name, loanList]) => ({
      borrower_name,
      loans: loanList,
      total: loanList.reduce((s, l) => s + Number(l.amount), 0),
      remaining: loanList.reduce((s, l) => s + Number(l.remaining || 0), 0),
    }));
  }

  viewLoan(loan: any, page: number = 1): void {
    this.selectedLoan = loan;
    this.loadingDetail = true;
    this.loadPayments(page);
  }

  loadPayments(page: number): void {
    if (!this.selectedLoan) return;
    const target = Math.max(1, Math.min(page, this.paymentTotalPages));
    this.paymentPage = target;
    this.loadingDetail = true;
    this.api.get<any>(`/loans/${this.selectedLoan.id}`, { page: this.paymentPage, limit: this.paymentPageSize }).subscribe({
      next: (res) => {
        this.loanDetail = res.data;
        this.payments = res.data.payments || [];
        this.paymentTotal = res.data.paymentTotal ?? this.payments.length;
        this.paymentTotalPages = Math.max(1, res.data.paymentTotalPages ?? 1);
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
    this.selectedLoan = null;
    this.loanDetail = null;
    this.payments = [];
    this.paymentPage = 1;
    this.paymentTotal = 0;
    this.paymentTotalPages = 1;
    this.loadLoans();
    this.loadSummary();
  }

  getProgressPercent(): number {
    if (!this.selectedLoan || !this.loanDetail || this.selectedLoan.amount <= 0) return 0;
    return Math.min(100, ((this.loanDetail.total_paid || 0) / this.selectedLoan.amount) * 100);
  }

  openLoanModal(): void {
    this.editingLoanId = null;
    this.loanForm.reset({
      borrower_name: '',
      amount: null,
      date: todayLocal(),
      description: '',
    });
    if (this.selectedLoan) {
      this.editingLoanId = this.selectedLoan.id;
      this.loanForm.patchValue({
        borrower_name: this.selectedLoan.borrower_name,
        amount: this.selectedLoan.amount,
        date: this.selectedLoan.date,
        description: this.selectedLoan.description || '',
      });
    }
    this.showLoanModal = true;
  }

  openLoanModalFor(borrowerName: string | undefined): void {
    this.editingLoanId = null;
    this.loanForm.reset({
      borrower_name: borrowerName || '',
      amount: null,
      date: todayLocal(),
      description: '',
    });
    this.showLoanModal = true;
  }

  closeLoanModal(): void {
    this.showLoanModal = false;
    this.editingLoanId = null;
  }

  editLoan(loan: any, event: Event): void {
    event.stopPropagation();
    this.editingLoanId = loan.id;
    this.loanForm.patchValue({
      borrower_name: loan.borrower_name,
      amount: loan.amount,
      date: loan.date,
      description: loan.description || '',
    });
    this.showLoanModal = true;
  }

  onSubmitLoan(): void {
    if (this.loanForm.invalid) return;
    this.saving = true;
    const request = this.editingLoanId
      ? this.api.put(`/loans/${this.editingLoanId}`, this.loanForm.value)
      : this.api.post('/loans', this.loanForm.value);
    request.subscribe({
      next: () => {
        this.loadLoans();
        this.loadSummary();
        if (this.selectedLoan) {
          this.viewLoan(this.selectedLoan);
        }
        this.closeLoanModal();
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  deleteLoan(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('¿Eliminar este préstamo y todos sus abonos?')) return;
    this.api.delete(`/loans/${id}`).subscribe({
      next: () => {
        this.loadLoans();
        this.loadSummary();
      },
    });
  }

  openPaymentModal(): void {
    this.paymentForm.reset({
      amount: null,
      date: todayLocal(),
      description: '',
    });
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
  }

  onSubmitPayment(): void {
    if (this.paymentForm.invalid || !this.selectedLoan) return;
    this.saving = true;
    this.api.post(`/loans/${this.selectedLoan.id}/payments`, this.paymentForm.value).subscribe({
      next: () => {
        this.loadPayments(1);
        this.loadSummary();
        this.loadLoans();
        this.closePaymentModal();
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  deletePayment(payment: any): void {
    if (!confirm('¿Eliminar este abono?')) return;
    this.api.delete(`/loans/${this.selectedLoan.id}/payments/${payment.id}`).subscribe({
      next: () => {
        this.loadPayments(this.paymentPage);
        this.loadSummary();
        this.loadLoans();
      },
    });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Activo',
      paid: 'Pagado',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  }

  formatDate = formatDateUtil;

}
