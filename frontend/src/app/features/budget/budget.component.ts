import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { formatCurrency } from '../../shared/utils/format';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, CurrencyInputComponent],
  template: `
    <div class="page">
      <!-- LIST VIEW -->
      <ng-container *ngIf="!selectedBudget">
        <div class="page-header">
          <h1>Presupuesto</h1>
          <button class="btn-primary" (click)="openBudgetModal()">+ Nuevo Presupuesto</button>
        </div>

        <div class="cards-grid">
          <div class="card" *ngFor="let b of budgets" (click)="selectBudget(b)">
            <div class="card-header">
              <span class="period-badge" [class.first]="b.period_type === 'first'" [class.second]="b.period_type === 'second'">
                {{ periodLabel(b) }}
              </span>
              <div class="card-actions">
                <button class="btn-icon" (click)="editBudget(b, $event)" title="Editar">✏️</button>
                <button class="btn-icon" (click)="deleteBudget(b.id, $event)" title="Eliminar">🗑️</button>
              </div>
            </div>
            <div class="card-body">
              <p class="card-dates">{{ b.start_date }} — {{ b.end_date }}</p>
              <p class="card-amount">{{ formatCurrency(b.total_income) }}</p>
            </div>
          </div>
        </div>

        <div class="empty-state" *ngIf="budgets.length === 0 && !loading">
          <p>No hay presupuestos registrados</p>
        </div>
      </ng-container>

      <!-- DETAIL VIEW -->
      <ng-container *ngIf="selectedBudget">
        <div class="page-header">
          <div class="header-left">
            <button class="btn-back" (click)="backToList()">← Volver</button>
            <h1>{{ periodLabel(selectedBudget) }}</h1>
          </div>
          <div class="header-actions">
            <button class="btn-copy" (click)="copyNext()" title="Crear el siguiente período con los ítems activos">⏭ Siguiente Período</button>
            <button class="btn-primary" (click)="saveDraft()" [disabled]="saving">
              {{ saving ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>

        <p class="detail-dates">{{ selectedBudget.start_date }} — {{ selectedBudget.end_date }}</p>

        <!-- Total Income -->
        <div class="income-box">
          <div class="form-group income-input">
            <label for="total_income">Total Presupuestado</label>
            <app-currency-input id="total_income" [(ngModel)]="totalIncome" placeholder="0" />
          </div>
          <div class="income-summary">
            <div class="summary-item">
              <span class="summary-label">Asignado</span>
              <span class="summary-value warning">{{ formatCurrency(assignedTotal) }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Libre</span>
              <span class="summary-value" [class.positive]="freeAmount >= 0" [class.negative]="freeAmount < 0">
                {{ formatCurrency(freeAmount) }}
              </span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Asignado</span>
              <span class="summary-value">{{ assignedPercent }}%</span>
            </div>
          </div>
        </div>

        <!-- Items Form -->
        <div class="form-table" *ngIf="draftItems.length > 0">
          <div class="form-row header-row">
            <span>{{ selectedBudget?.budget_type === 'income' ? 'Concepto' : 'Ítem' }}</span>
            <span>Monto</span>
            <span>%</span>
            <span>Pagado</span>
            <span>Inactivo</span>
            <span></span>
          </div>
          <div class="form-row" *ngFor="let item of draftItems" [class.row-cancelled]="item.status === 'cancelled'">
            <input type="text" [(ngModel)]="item.name" placeholder="Nombre del ítem" />
            <app-currency-input [(ngModel)]="item.amount" placeholder="0" />
            <span class="pct-cell">{{ itemPercent(item) }}%</span>
            <input class="check-cell" type="checkbox" [checked]="item.status === 'completed'"
              (change)="toggleCompleted(item, $event)" />
            <input class="check-cell" type="checkbox" [checked]="item.status === 'cancelled'"
              (change)="toggleCancelled(item, $event)" />
            <button class="btn-icon" (click)="removeDraftItem(item)" title="Eliminar">🗑️</button>
          </div>
          <button class="btn-add-row" (click)="addDraftItem()">+ Agregar Ítem</button>
        </div>

        <div class="empty-state" *ngIf="draftItems.length === 0 && !loading">
          <p>No hay ítems en este presupuesto</p>
          <button class="btn-primary" (click)="addDraftItem()">+ Agregar primer ítem</button>
        </div>
      </ng-container>

      <!-- Budget Modal -->
      <div class="modal-overlay" *ngIf="showBudgetModal" (click)="closeBudgetModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingBudgetId ? 'Editar Presupuesto' : 'Nuevo Presupuesto' }}</h2>
            <button class="btn-close" (click)="closeBudgetModal()">&times;</button>
          </div>

          <div class="form-group">
            <label for="budget_type">Tipo</label>
            <select id="budget_type" [(ngModel)]="budgetForm.budget_type">
              <option *ngFor="let t of budgetTypes" [value]="t.value">{{ t.label }}</option>
            </select>
          </div>

          <div class="form-group">
            <label for="cycle">Ciclo / Periodicidad</label>
            <select id="cycle" [(ngModel)]="budgetForm.cycle">
              <option *ngFor="let c of budgetCycles" [value]="c.value">{{ c.label }}</option>
            </select>
          </div>

          <div class="form-group">
            <label for="period_type">Periodo</label>
            <select id="period_type" [(ngModel)]="budgetForm.period_type">
              <option value="first">Periodo 1</option>
              <option value="second">Periodo 2</option>
            </select>
          </div>

          <div class="form-group">
            <label for="start_date">Fecha Inicio</label>
            <input id="start_date" type="date" [(ngModel)]="budgetForm.start_date" />
          </div>

          <div class="form-group">
            <label for="end_date">Fecha Fin</label>
            <input id="end_date" type="date" [(ngModel)]="budgetForm.end_date" />
          </div>

          <div class="form-group">
            <label for="total_income">Ingreso Total</label>
            <app-currency-input id="total_income" [(ngModel)]="budgetForm.total_income" placeholder="0" />
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeBudgetModal()">Cancelar</button>
            <button class="btn-primary" [disabled]="saving" (click)="submitBudget()">
              {{ saving ? 'Guardando...' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>

      </div>
  `
})
export class BudgetComponent implements OnInit {
  formatCurrency = formatCurrency;
  budgets: any[] = [];
  selectedBudget: any = null;
  draftItems: any[] = [];
  totalIncome: number | null = null;
  loading = false;

  showBudgetModal = false;
  editingBudgetId: number | null = null;
  budgetForm = { period_type: 'first', budget_type: 'expense', cycle: 'biweekly', start_date: '', end_date: '', total_income: null as number | null };

  saving = false;

  budgetTypes = [
    { value: 'income', label: 'Ingreso' },
    { value: 'expense', label: 'Gasto' },
    { value: 'remesa', label: 'Remesa' },
    { value: 'investment', label: 'Inversión' },
    { value: 'debt', label: 'Deuda / Pago' },
    { value: 'other', label: 'Otro' },
  ];

  budgetCycles = [
    { value: 'daily', label: 'Diario' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'biweekly', label: 'Quincenal' },
    { value: 'monthly', label: 'Mensual' },
    { value: 'other', label: 'Otro' },
  ];

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadBudgets();
  }

  loadBudgets(): void {
    this.loading = true;
    this.api.get<any>('/budgets').subscribe({
      next: (res) => { this.budgets = res.data || res; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  selectBudget(budget: any): void {
    this.selectedBudget = budget;
    this.loadBudgetDetail(budget.id);
  }

  loadBudgetDetail(id: number): void {
    this.loading = true;
    this.api.get<any>(`/budgets/${id}`).subscribe({
      next: (res) => {
        const budget = res.data?.budget || res.data || res;
        const items = res.data?.items || budget.items || [];
        this.totalIncome = Number(budget.total_income) || null;
        this.draftItems = (items || []).map((i: any) => ({ ...i, amount: Number(i.amount) }));
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  backToList(): void {
    this.selectedBudget = null;
    this.draftItems = [];
    this.totalIncome = null;
    this.loadBudgets();
  }

  addDraftItem(): void {
    this.draftItems.push({ id: null, name: '', amount: null, status: 'pending', is_recurrent: false, notes: '' });
  }

  removeDraftItem(item: any): void {
    if (item.id) {
      if (!confirm('¿Eliminar este gasto?')) return;
      this.api.delete(`/budgets/${this.selectedBudget.id}/items/${item.id}`).subscribe({
        next: () => this.loadBudgetDetail(this.selectedBudget.id),
      });
    } else {
      this.draftItems = this.draftItems.filter(i => i !== item);
    }
  }

  toggleCompleted(item: any, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      item.status = 'completed';
    } else if (item.status === 'completed') {
      item.status = 'pending';
    }
  }

  toggleCancelled(item: any, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      item.status = 'cancelled';
    } else if (item.status === 'cancelled') {
      item.status = 'pending';
    }
  }

  get activeItems(): any[] {
    return this.draftItems.filter(i => i.status !== 'cancelled');
  }

  get assignedTotal(): number {
    return this.activeItems.reduce((sum: number, i: any) => sum + (Number(i.amount) || 0), 0);
  }

  get freeAmount(): number {
    return (Number(this.totalIncome) || 0) - this.assignedTotal;
  }

  get assignedPercent(): number {
    const total = Number(this.totalIncome) || 0;
    if (total <= 0) return 0;
    return Math.round((this.assignedTotal / total) * 100);
  }

  itemPercent(item: any): number {
    const total = Number(this.totalIncome) || 0;
    if (total <= 0) return 0;
    return Math.round(((Number(item.amount) || 0) / total) * 100);
  }

  saveDraft(): void {
    this.saving = true;
    const payload: any = { items: this.draftItems.map((i: any) => ({
      id: i.id ?? undefined,
      name: i.name,
      amount: Number(i.amount) || null,
      status: i.status,
    })) };
    if (this.totalIncome != null) {
      payload.total_income = this.totalIncome;
    }
    this.api.put(`/budgets/${this.selectedBudget.id}/items/bulk`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.loadBudgetDetail(this.selectedBudget.id);
      },
      error: () => { this.saving = false; },
    });
  }

  copyNext(): void {
    if (!confirm('¿Crear la siguiente quincena con los gastos activos?')) return;
    this.saving = true;
    this.api.post(`/budgets/${this.selectedBudget.id}/copy`, {}).subscribe({
      next: (res: any) => {
        this.saving = false;
        const newBudget = res.data || res;
        this.budgets = [...this.budgets, newBudget];
        this.selectedBudget = newBudget;
        this.loadBudgetDetail(newBudget.id);
      },
      error: () => { this.saving = false; },
    });
  }

  // Budget CRUD
  openBudgetModal(): void {
    this.editingBudgetId = null;
    this.budgetForm = { period_type: 'first', budget_type: 'expense', cycle: 'biweekly', start_date: '', end_date: '', total_income: null };
    this.showBudgetModal = true;
  }

  editBudget(budget: any, event: Event): void {
    event.stopPropagation();
    this.editingBudgetId = budget.id;
    this.budgetForm = {
      period_type: budget.period_type,
      budget_type: budget.budget_type || 'expense',
      cycle: budget.cycle || 'biweekly',
      start_date: budget.start_date,
      end_date: budget.end_date,
      total_income: budget.total_income,
    };
    this.showBudgetModal = true;
  }

  closeBudgetModal(): void {
    this.showBudgetModal = false;
    this.editingBudgetId = null;
  }

  submitBudget(): void {
    this.saving = true;
    const data: any = {
      period_type: this.budgetForm.period_type,
      budget_type: this.budgetForm.budget_type,
      cycle: this.budgetForm.cycle,
      start_date: this.budgetForm.start_date,
      end_date: this.budgetForm.end_date,
    };
    if (this.budgetForm.total_income != null) {
      data.total_income = this.budgetForm.total_income;
    }

    const request = this.editingBudgetId
      ? this.api.put(`/budgets/${this.editingBudgetId}`, data)
      : this.api.post('/budgets', data);

    request.subscribe({
      next: () => {
        this.closeBudgetModal();
        if (this.selectedBudget) {
          this.loadBudgetDetail(this.selectedBudget.id);
        } else {
          this.loadBudgets();
        }
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  deleteBudget(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('¿Eliminar este presupuesto y todos sus gastos?')) return;
    this.api.delete(`/budgets/${id}`).subscribe({ next: () => this.loadBudgets() });
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = { completed: 'Pagado', pending: 'Pendiente', cancelled: 'Cancelado' };
    return labels[status] || status;
  }

  get typeLabel(): string {
    const t = this.budgetTypes.find(x => x.value === this.budgetForm.budget_type);
    return t ? t.label : 'Gasto';
  }

  get cycleLabel(): string {
    const c = this.budgetCycles.find(x => x.value === this.budgetForm.cycle);
    return c ? c.label : 'Quincenal';
  }

  typeLabelFor(type: string): string {
    const t = this.budgetTypes.find(x => x.value === type);
    return t ? t.label : 'Gasto';
  }

  cycleLabelFor(cycle: string | undefined): string {
    const c = this.budgetCycles.find(x => x.value === (cycle || 'biweekly'));
    return c ? c.label : 'Quincenal';
  }

  periodLabel(b: any): string {
    const base = this.typeLabelFor(b.budget_type) + ' · ' + this.cycleLabelFor(b.cycle);
    if ((b.cycle || 'biweekly') === 'biweekly') {
      return base + ' · ' + (b.period_type === 'first' ? '1ra Quincena' : '2da Quincena');
    }
    return base + ' · ' + (b.period_type === 'first' ? 'Periodo 1' : 'Periodo 2');
  }

}
