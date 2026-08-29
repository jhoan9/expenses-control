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
    .person-group {
      margin-bottom: 24px;
    }
    .person-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      background: white;
      padding: 12px 16px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      flex-wrap: wrap;
    }
    .person-info h3 {
      margin: 0;
      color: #333;
      font-size: 1.05rem;
    }
    .person-meta {
      display: block;
      font-size: 0.85rem;
      color: #888;
      margin-top: 2px;
    }
    .person-meta strong { color: #333; }
    .btn-primary-sm {
      background: #4caf50;
      color: white;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.9rem;
    }
    .btn-primary-sm:hover { background: #43a047; }
    .hint {
      display: block;
      font-size: 0.8rem;
      color: #888;
      margin-top: 4px;
    }
    .loan-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s;
    }
    .loan-card:hover { transform: translateY(-2px); }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .card-header h3 { margin: 0; color: #333; }
    .status-badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .status-active { background: #e8f5e9; color: #2e7d32; }
    .status-paid { background: #e3f2fd; color: #1565c0; }
    .status-cancelled { background: #ffebee; color: #c62828; }
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
    .desc-text {
      font-size: 0.85rem !important;
      max-width: 180px;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 4px;
      margin-bottom: 8px;
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
    .progress-container {
      margin-bottom: 16px;
      background: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .progress-bar {
      width: 100%;
      height: 10px;
      background: #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
      margin-bottom: 6px;
    }
    .progress-fill {
      height: 100%;
      background: #4caf50;
      border-radius: 5px;
      transition: width 0.3s ease;
    }
    .progress-text {
      font-size: 0.85rem;
      color: #888;
    }
    .detail-description {
      margin-bottom: 16px;
      background: white;
      padding: 16px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      font-size: 0.95rem;
      color: #555;
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
  `]
})
export class LoansComponent implements OnInit {
  formatCurrency = formatCurrency;
  loans: any[] = [];
  summary: any = null;
  selectedLoan: any = null;
  loanDetail: any = null;
  payments: any[] = [];
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

  viewLoan(loan: any): void {
    this.selectedLoan = loan;
    this.loadingDetail = true;
    this.api.get<any>(`/loans/${loan.id}`).subscribe({
      next: (res) => {
        this.loanDetail = res.data;
        this.payments = res.data.payments || [];
        this.loadingDetail = false;
      },
      error: () => { this.loadingDetail = false; },
    });
  }

  goBack(): void {
    this.selectedLoan = null;
    this.loanDetail = null;
    this.payments = [];
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
        this.viewLoan(this.selectedLoan);
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
        this.viewLoan(this.selectedLoan);
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
