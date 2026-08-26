import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input/currency-input.component';
import { formatCurrency } from '../../shared/utils/format';

@Component({
  selector: 'app-investments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CurrencyInputComponent],
  template: `
    <div class="page">
      <div class="page-header">
        <h1>Inversiones</h1>
        <button class="btn-primary" (click)="openInvestmentModal()">+ Nueva Inversión</button>
      </div>

      <div class="tabs">
        <button class="tab" [class.active]="activeTab === 'investments'" (click)="activeTab = 'investments'">Inversiones</button>
        <button class="tab" [class.active]="activeTab === 'positions'" (click)="activeTab = 'positions'; loadOpenPositions()">Posiciones Abiertas</button>
        <button class="tab" [class.active]="activeTab === 'closed'" (click)="activeTab = 'closed'; loadClosedPositions()">Cerradas</button>
      </div>

      <!-- Investments Tab -->
      <div *ngIf="activeTab === 'investments'">
        <div class="cards-grid" *ngIf="selectedInvestment === null">
          <div class="investment-card" *ngFor="let inv of investments" (click)="viewInvestment(inv)">
            <div class="card-header">
              <div>
                <h3>{{ inv.name }}</h3>
                <span class="ticker" *ngIf="inv.ticker">{{ inv.ticker }}</span>
                <span class="exchange" *ngIf="inv.exchange"> · {{ inv.exchange }}</span>
              </div>
              <div class="card-actions">
                <button class="btn-icon" (click)="editInvestment(inv, $event)">✏️</button>
                <button class="btn-icon" (click)="deleteInvestment(inv.id, $event)">🗑️</button>
              </div>
            </div>
            <span class="type-badge" [class]="'type-' + inv.type">{{ getTypeLabel(inv.type) }}</span>
          </div>
        </div>

        <!-- Investment Detail -->
        <div *ngIf="selectedInvestment !== null">
          <div class="detail-header">
            <button class="btn-back" (click)="selectedInvestment = null; selectedPositions = []">← Volver</button>
            <div class="detail-info">
              <h2>{{ selectedInvestment.name }}</h2>
              <span class="ticker-lg" *ngIf="selectedInvestment.ticker">{{ selectedInvestment.ticker }}</span>
              <span class="exchange" *ngIf="selectedInvestment.exchange"> · {{ selectedInvestment.exchange }}</span>
              <span class="type-badge" [class]="'type-' + selectedInvestment.type">{{ getTypeLabel(selectedInvestment.type) }}</span>
            </div>
            <div class="detail-actions">
              <button class="btn-action btn-buy" (click)="openTradeModal('buy')">Comprar</button>
              <button class="btn-action btn-sell" (click)="openTradeModal('sell')" *ngIf="hasOpenQuantity(selectedInvestment)">Vender</button>
            </div>
          </div>

          <div class="summary-bar" *ngIf="selectedInvestment">
            <div class="summary-item">
              <span>Cantidad Abierta</span>
              <strong>{{ formatQuantity(selectedInvestment.open_quantity) }}</strong>
            </div>
            <div class="summary-item">
              <span>Precio Promedio</span>
              <strong>{{ formatCurrency(selectedInvestment.avg_cost || 0) }}</strong>
            </div>
            <div class="summary-item">
              <span>Operaciones</span>
              <strong>{{ operations.length }}</strong>
            </div>
            <div class="summary-item">
              <span>Ganancia Realizada</span>
              <strong [class.result-positive]="operationsPnl() >= 0" [class.result-negative]="operationsPnl() < 0">
                {{ operationsPnl() >= 0 ? '+' : '' }}{{ formatCurrency(operationsPnl()) }}
              </strong>
            </div>
          </div>

          <!-- Operaciones (compra + sus ventas) -->
          <div class="operations-list" *ngIf="operations.length > 0">
            <div class="operation-card" *ngFor="let op of operations" [class.op-closed]="op.status === 'closed'">
              <div class="op-header">
                <span class="trade-badge trade-buy">COMPRA</span>
                <span class="op-date">{{ formatDate(op.opened_at) }}</span>
                <strong class="op-main">{{ formatQuantity(op.quantity) }} @ {{ formatCurrency(op.unit_price) }}</strong>
                <span class="op-total">{{ formatCurrency(op.total_cost) }}</span>
                <span class="status-badge-op" [class.closed]="op.status === 'closed'">{{ op.status === 'closed' ? 'Cerrada' : 'Abierta' }}</span>
              </div>

              <div class="op-sells" *ngIf="op.sells.length > 0">
                <div class="op-sell-row" *ngFor="let s of op.sells">
                  <span class="trade-badge trade-sell">VENTA</span>
                  <span class="op-date">{{ formatDate(s.opened_at) }}</span>
                  <span class="op-main">{{ formatQuantity(s.quantity) }} @ {{ formatCurrency(s.unit_price) }}</span>
                  <span class="op-total">{{ formatCurrency(s.total_value) }}</span>
                  <span class="op-pnl" [class.result-positive]="s.realized_pnl >= 0" [class.result-negative]="s.realized_pnl < 0">
                    {{ s.realized_pnl >= 0 ? '+' : '' }}{{ formatCurrency(s.realized_pnl) }}
                  </span>
                </div>
              </div>

              <div class="op-footer">
                <span>Vendido: <strong>{{ formatQuantity(op.sold_quantity) }} / {{ formatQuantity(op.quantity) }}</strong></span>
                <span *ngIf="op.remaining_quantity > 0">Restante: <strong>{{ formatQuantity(op.remaining_quantity) }}</strong></span>
                <span *ngIf="op.avg_sell_price > 0">Prom. venta: <strong>{{ formatCurrency(op.avg_sell_price) }}</strong></span>
                <span *ngIf="op.sells.length > 0">
                  P&L: <strong [class.result-positive]="op.realized_pnl >= 0" [class.result-negative]="op.realized_pnl < 0">
                    {{ op.realized_pnl >= 0 ? '+' : '' }}{{ formatCurrency(op.realized_pnl) }}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div class="empty-state" *ngIf="operations.length === 0 && !loadingDetail">
            <p>No hay operaciones registradas para esta inversión</p>
          </div>
        </div>

        <div class="empty-state" *ngIf="investments.length === 0 && !loading && selectedInvestment === null">
          <p>No hay inversiones registradas</p>
          <button class="btn-primary" (click)="openInvestmentModal()">Crear primera inversión</button>
        </div>
      </div>

      <!-- Open Positions Tab -->
      <div *ngIf="activeTab === 'positions'">
        <div class="summary-bar" *ngIf="openPositions.length > 0">
          <div class="summary-item">
            <span>Total Invertido</span>
            <strong>{{ formatCurrency(totalInvested) }}</strong>
          </div>
          <div class="summary-item">
            <span>Posiciones Abiertas</span>
            <strong>{{ openPositions.length }}</strong>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ticker</th>
                <th>Tipo</th>
                <th>Cantidad Abierta</th>
                <th>Costo Total</th>
                <th>Precio Promedio</th>
                <th>Operaciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let pos of openPositions" (click)="goToInvestment(pos.investment_id)" class="clickable-row">
                <td>{{ pos.name }}</td>
                <td><span class="ticker">{{ pos.ticker || '-' }}</span></td>
                <td><span class="type-badge" [class]="'type-' + pos.type">{{ getTypeLabel(pos.type) }}</span></td>
                <td>{{ formatQuantity(pos.open_quantity) }}</td>
                <td>{{ formatCurrency(pos.total_cost) }}</td>
                <td>{{ formatCurrency(pos.avg_cost) }}</td>
                <td>{{ pos.position_count }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" *ngIf="openPositions.length === 0 && !loadingPositions">
          <p>No hay posiciones abiertas</p>
        </div>
      </div>

      <!-- Closed Positions Tab -->
      <div *ngIf="activeTab === 'closed'">
        <div class="summary-bar" *ngIf="closedPositions.length > 0">
          <div class="summary-item">
            <span>Total Invertido (cerrado)</span>
            <strong>{{ formatCurrency(closedTotalInvested) }}</strong>
          </div>
          <div class="summary-item">
            <span>Total Recibido</span>
            <strong>{{ formatCurrency(closedTotalReceived) }}</strong>
          </div>
          <div class="summary-item">
            <span>Resultado</span>
            <strong [class.result-positive]="closedResult >= 0" [class.result-negative]="closedResult < 0">
              {{ formatCurrency(closedResult) }}
            </strong>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Ticker</th>
                <th>Tipo</th>
                <th>Comprado</th>
                <th>Vendido</th>
                <th>Valor Invertido</th>
                <th>Valor Recibido</th>
                <th>Resultado</th>
                <th>Cerrada el</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let pos of closedPositions" (click)="goToInvestment(pos.investment_id)" class="clickable-row">
                <td>{{ pos.name }}</td>
                <td><span class="ticker">{{ pos.ticker || '-' }}</span></td>
                <td><span class="type-badge" [class]="'type-' + pos.type">{{ getTypeLabel(pos.type) }}</span></td>
                <td>{{ formatQuantity(pos.bought_quantity) }}</td>
                <td>{{ formatQuantity(pos.sold_quantity) }}</td>
                <td>{{ formatCurrency(pos.bought_value) }}</td>
                <td>{{ formatCurrency(pos.sold_value) }}</td>
                <td>
                  <span class="result-badge" [class.result-positive]="positionResult(pos) >= 0" [class.result-negative]="positionResult(pos) < 0">
                    {{ formatCurrency(positionResult(pos)) }}
                  </span>
                </td>
                <td>{{ formatDate(pos.closed_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="empty-state" *ngIf="closedPositions.length === 0 && !loadingClosed">
          <p>No hay posiciones cerradas</p>
        </div>
      </div>

      <!-- Investment Modal -->
      <div class="modal-overlay" *ngIf="showInvestmentModal" (click)="closeInvestmentModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ editingInvestmentId ? 'Editar Inversión' : 'Nueva Inversión' }}</h2>
            <button class="btn-close" (click)="closeInvestmentModal()">&times;</button>
          </div>
          <form [formGroup]="investmentForm" (ngSubmit)="onSubmitInvestment()">
            <div class="form-group">
              <label for="inv-name">Nombre</label>
              <input id="inv-name" formControlName="name" placeholder="Ej: Ecopetrol, Bitcoin..." />
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="inv-ticker">Ticker</label>
                <input id="inv-ticker" formControlName="ticker" placeholder="Ej: ECOPETROL, BTC..." />
              </div>
              <div class="form-group">
                <label for="inv-exchange">Exchange</label>
                <input id="inv-exchange" formControlName="exchange" placeholder="Ej: BVC, NYSE..." />
              </div>
            </div>
            <div class="form-group">
              <label for="inv-type">Tipo</label>
              <select id="inv-type" formControlName="type">
                <option value="">Seleccionar tipo</option>
                <option value="stock">Acción</option>
                <option value="bond">Bono</option>
                <option value="etf">ETF</option>
                <option value="crypto">Criptomoneda</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeInvestmentModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [disabled]="investmentForm.invalid || saving">
                {{ saving ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Trade Modal -->
      <div class="modal-overlay" *ngIf="showTradeModal" (click)="closeTradeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ tradeType === 'buy' ? 'Comprar' : 'Vender' }} {{ selectedInvestment?.name }}</h2>
            <button class="btn-close" (click)="closeTradeModal()">&times;</button>
          </div>
          <form [formGroup]="tradeForm" (ngSubmit)="onSubmitTrade()">
            <div class="form-group">
              <label for="trade-account">Cuenta</label>
              <select id="trade-account" formControlName="account_id">
                <option value="">Seleccionar cuenta</option>
                <option *ngFor="let acc of accounts" [value]="acc.id">{{ acc.name }}</option>
              </select>
            </div>
            <div class="form-group" *ngIf="tradeType === 'sell' && sellLots.length > 1">
              <label for="trade-position">Posición a vender</label>
              <select id="trade-position" formControlName="position_id">
                <option value="">Automático (FIFO - primera abierta)</option>
                <option *ngFor="let lot of sellLots" [value]="lot.id">
                  #{{ lot.id }} · {{ formatQuantity(lot.remaining) }} disp. · {{ formatCurrency(lot.unit_price) }}
                </option>
              </select>
              <small class="field-hint" *ngIf="selectedLot()">
                Vendiendo desde la posición #{{ selectedLot().id }} (comprada a {{ formatCurrency(selectedLot().unit_price) }}). Máximo: {{ formatQuantity(selectedLot().remaining) }}.
              </small>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="trade-qty">Cantidad</label>
                <input id="trade-qty" type="number" formControlName="quantity" placeholder="0" min="0.0001" step="any" />
              </div>
              <div class="form-group">
                <label for="trade-price">Precio Unitario</label>
                <app-currency-input id="trade-price" formControlName="unit_price" placeholder="0" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="trade-commission">Comisión</label>
                <app-currency-input id="trade-commission" formControlName="commission" placeholder="0" />
              </div>
              <div class="form-group">
                <label for="trade-date">Fecha</label>
                <input id="trade-date" type="date" formControlName="date" />
              </div>
            </div>
            <div class="form-group">
              <label for="trade-notes">Notas</label>
              <input id="trade-notes" formControlName="notes" placeholder="Notas opcionales..." />
            </div>
            <div class="trade-total" *ngIf="tradeForm.value.quantity && tradeForm.value.unit_price">
              <span>Total:</span>
              <strong>{{ formatCurrency((tradeForm.value.quantity * tradeForm.value.unit_price) + (tradeType === 'buy' ? (tradeForm.value.commission || 0) : -(tradeForm.value.commission || 0))) }}</strong>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-secondary" (click)="closeTradeModal()">Cancelar</button>
              <button type="submit" class="btn-primary" [class.btn-buy]="tradeType === 'buy'" [class.btn-sell]="tradeType === 'sell'" [disabled]="tradeForm.invalid || saving">
                {{ saving ? 'Guardando...' : (tradeType === 'buy' ? 'Comprar' : 'Vender') }}
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
    .tabs {
      display: flex;
      gap: 0;
      margin-bottom: 24px;
      border-bottom: 2px solid #eee;
    }
    .tab {
      background: none;
      border: none;
      padding: 12px 24px;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 500;
      color: #888;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
    }
    .tab:hover { color: #333; }
    .tab.active {
      color: #4caf50;
      border-bottom-color: #4caf50;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .investment-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s;
      cursor: pointer;
    }
    .investment-card:hover { transform: translateY(-2px); }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .card-header h3 { margin: 0 0 4px 0; color: #333; }
    .card-actions { display: flex; gap: 4px; }
    .ticker {
      display: inline-block;
      font-size: 0.85rem;
      color: #666;
      font-weight: 600;
      background: #f5f5f5;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .ticker-lg {
      font-size: 1rem;
      color: #666;
      font-weight: 600;
      background: #f5f5f5;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .exchange { color: #999; font-size: 0.85rem; }
    .type-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .type-stock { background: #e3f2fd; color: #1565c0; }
    .type-bond { background: #f3e5f5; color: #7b1fa2; }
    .type-etf { background: #e8f5e9; color: #2e7d32; }
    .type-crypto { background: #fff3e0; color: #e65100; }
    .type-other { background: #f5f5f5; color: #616161; }
    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      padding: 4px;
      border-radius: 4px;
    }
    .btn-icon:hover { background: #f0f0f0; }
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
    .detail-actions { display: flex; gap: 8px; }
    .btn-action {
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      font-size: 0.9rem;
    }
    .btn-buy { background: #4caf50; color: white; }
    .btn-buy:hover { background: #43a047; }
    .btn-sell { background: #e53935; color: white; }
    .btn-sell:hover { background: #c62828; }
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
    .clickable-row { cursor: pointer; }
    .result-positive { color: #2e7d32 !important; }
    .result-negative { color: #c62828 !important; }
    .result-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
    }
    .trade-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .trade-buy { background: #e8f5e9; color: #2e7d32; }
    .trade-sell { background: #ffebee; color: #c62828; }
    .operations-list { display: flex; flex-direction: column; gap: 12px; }
    .operation-card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      padding: 14px 16px;
      border-left: 4px solid #4caf50;
    }
    .operation-card.op-closed { border-left-color: #9e9e9e; opacity: 0.85; }
    .op-header, .op-sell-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .op-header { margin-bottom: 6px; }
    .op-sells {
      border-top: 1px dashed #eee;
      margin-top: 6px;
      padding-top: 6px;
    }
    .op-sell-row { margin-bottom: 4px; font-size: 0.92rem; }
    .op-date { color: #888; font-size: 0.85rem; min-width: 80px; }
    .op-main { font-weight: 600; color: #333; flex: 1; }
    .op-total { color: #555; font-weight: 500; }
    .op-pnl { font-weight: 600; min-width: 90px; text-align: right; }
    .status-badge-op {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.78rem;
      font-weight: 600;
      background: #fff3e0;
      color: #e65100;
    }
    .status-badge-op.closed { background: #eeeeee; color: #757575; }
    .op-footer {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
      font-size: 0.85rem;
      color: #666;
    }
    .op-footer strong { color: #333; }
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
      background: white;
      border-radius: 8px;
    }
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
      max-width: 520px;
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
    .form-row {
      display: flex;
      gap: 12px;
    }
    .form-group {
      padding: 0 20px;
      margin-bottom: 16px;
      flex: 1;
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
    .field-hint {
      display: block;
      margin-top: 4px;
      font-size: 0.8rem;
      color: #6b7280;
    }
    .trade-total {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      font-size: 1.1rem;
    }
    .trade-total strong { color: #333; }
  `]
})
export class InvestmentsComponent implements OnInit {
  formatCurrency = formatCurrency;
  investments: any[] = [];
  openPositions: any[] = [];
  closedPositions: any[] = [];
  selectedInvestment: any = null;
  selectedPositions: any[] = [];
  operations: any[] = [];
  accounts: any[] = [];
  loading = false;
  loadingDetail = false;
  loadingPositions = false;
  loadingClosed = false;
  saving = false;
  activeTab: 'investments' | 'positions' | 'closed' = 'investments';
  showInvestmentModal = false;
  showTradeModal = false;
  editingInvestmentId: number | null = null;
  tradeType: 'buy' | 'sell' = 'buy';
  investmentForm: FormGroup;
  tradeForm: FormGroup;

  constructor(private api: ApiService, private fb: FormBuilder) {
    this.investmentForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      ticker: [''],
      exchange: [''],
      type: ['', [Validators.required]],
    });
    this.tradeForm = this.fb.group({
      account_id: [null, [Validators.required]],
      quantity: [null, [Validators.required, Validators.min(0.0001)]],
      unit_price: [null, [Validators.required, Validators.min(0)]],
      commission: [0],
      date: [new Date().toISOString().split('T')[0]],
      notes: [''],
      position_id: [''],
    });
  }

  ngOnInit(): void {
    this.loadInvestments();
    this.loadAccounts();
  }

  loadInvestments(): void {
    this.loading = true;
    this.api.get<any>('/investments').subscribe({
      next: (res) => { this.investments = res.data; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  loadAccounts(): void {
    this.api.get<any>('/accounts').subscribe({
      next: (res) => { this.accounts = res.data; },
    });
  }

  loadOpenPositions(): void {
    this.loadingPositions = true;
    this.api.get<any>('/investments/positions').subscribe({
      next: (res) => { this.openPositions = res.data; this.loadingPositions = false; },
      error: () => { this.loadingPositions = false; },
    });
  }

  loadClosedPositions(): void {
    this.loadingClosed = true;
    this.api.get<any>('/investments/positions/closed').subscribe({
      next: (res) => { this.closedPositions = res.data; this.loadingClosed = false; },
      error: () => { this.loadingClosed = false; },
    });
  }

  get closedTotalInvested(): number {
    return this.closedPositions.reduce((sum: number, p: any) => sum + Number(p.bought_value), 0);
  }

  get closedTotalReceived(): number {
    return this.closedPositions.reduce((sum: number, p: any) => sum + Number(p.sold_value), 0);
  }

  get closedResult(): number {
    return this.closedTotalReceived - this.closedTotalInvested;
  }

  hasOpenQuantity(inv: any): boolean {
    return (Number(inv.open_quantity) || 0) > 0;
  }

  formatQuantity(quantity: number): string {
    const q = Number(quantity) || 0;
    const isInteger = Number.isInteger(q);
    return q.toLocaleString('es-CO', { maximumFractionDigits: isInteger ? 0 : 4 });
  }

  positionResult(pos: any): number {
    return Number(pos.sold_value) - Number(pos.bought_value);
  }

  viewInvestment(inv: any): void {
    this.loadingDetail = true;
    this.api.get<any>(`/investments/${inv.id}`).subscribe({
      next: (res) => {
        this.selectedInvestment = res.data;
        this.selectedPositions = res.data.positions || [];
        this.loadingDetail = false;
      },
      error: () => { this.loadingDetail = false; },
    });
    this.loadOperations(inv.id);
  }

  loadOperations(investmentId: number): void {
    this.api.get<any>(`/investments/${investmentId}/operations`).subscribe({
      next: (res) => { this.operations = res.data || []; },
      error: () => { this.operations = []; },
    });
  }

  refreshDetail(): void {
    if (!this.selectedInvestment) return;
    const id = this.selectedInvestment.id;
    this.api.get<any>(`/investments/${id}`).subscribe({
      next: (res) => { this.selectedInvestment = res.data; this.selectedPositions = res.data.positions || []; },
    });
    this.loadOperations(id);
    this.loadInvestments();
  }

  operationsPnl(): number {
    return Math.round(this.operations.reduce((sum, op) => sum + (Number(op.realized_pnl) || 0), 0) * 100000) / 100000;
  }

  goToInvestment(id: number): void {
    const inv = this.investments.find(i => i.id === id);
    if (inv) {
      this.activeTab = 'investments';
      this.viewInvestment(inv);
    }
  }

  get totalInvested(): number {
    return this.openPositions.reduce((sum: number, p: any) => sum + (Number(p.cost_basis ?? p.total_cost) || 0), 0);
  }

  openInvestmentModal(): void {
    this.editingInvestmentId = null;
    this.investmentForm.reset({ name: '', ticker: '', exchange: '', type: '' });
    this.showInvestmentModal = true;
  }

  closeInvestmentModal(): void {
    this.showInvestmentModal = false;
    this.editingInvestmentId = null;
  }

  editInvestment(inv: any, event: Event): void {
    event.stopPropagation();
    this.editingInvestmentId = inv.id;
    this.investmentForm.patchValue({
      name: inv.name,
      ticker: inv.ticker || '',
      exchange: inv.exchange || '',
      type: inv.type,
    });
    this.showInvestmentModal = true;
  }

  onSubmitInvestment(): void {
    if (this.investmentForm.invalid) return;
    this.saving = true;
    const request = this.editingInvestmentId
      ? this.api.put(`/investments/${this.editingInvestmentId}`, this.investmentForm.value)
      : this.api.post('/investments', this.investmentForm.value);
    request.subscribe({
      next: () => {
        this.loadInvestments();
        this.closeInvestmentModal();
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  deleteInvestment(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('¿Eliminar esta inversión y todas sus posiciones?')) return;
    this.api.delete(`/investments/${id}`).subscribe({
      next: () => {
        if (this.selectedInvestment?.id === id) {
          this.selectedInvestment = null;
          this.selectedPositions = [];
        }
        this.loadInvestments();
      },
    });
  }

  openTradeModal(type: 'buy' | 'sell'): void {
    this.tradeType = type;
    this.tradeForm.reset({
      account_id: null,
      quantity: null,
      unit_price: null,
      commission: 0,
      date: new Date().toISOString().split('T')[0],
      notes: '',
      position_id: '',
    });
    this.showTradeModal = true;
  }

  get sellLots(): any[] {
    return this.selectedInvestment?.lots || [];
  }

  selectedLot(): any {
    const id = Number(this.tradeForm.get('position_id')?.value);
    if (!id) return null;
    return this.sellLots.find(l => l.id === id) || null;
  }

  maxSellQuantity(): number | null {
    const lot = this.selectedLot();
    if (lot) return lot.remaining;
    return null;
  }

  closeTradeModal(): void {
    this.showTradeModal = false;
  }

  onSubmitTrade(): void {
    if (this.tradeForm.invalid || !this.selectedInvestment) return;
    this.saving = true;
    const endpoint = this.tradeType === 'buy'
      ? `/investments/${this.selectedInvestment.id}/buy`
      : `/investments/${this.selectedInvestment.id}/sell`;
    const payload: any = { ...this.tradeForm.value };
    if (payload.position_id) {
      payload.position_id = Number(payload.position_id);
    } else {
      delete payload.position_id;
    }
    this.api.post(endpoint, payload).subscribe({
      next: () => {
        this.refreshDetail();
        this.closeTradeModal();
        this.saving = false;
      },
      error: () => { this.saving = false; },
    });
  }

  getTypeLabel(type: string): string {
    const labels: Record<string, string> = { stock: 'Acción', bond: 'Bono', etf: 'ETF', crypto: 'Crypto', other: 'Otro' };
    return labels[type] || type;
  }

  formatDate(date: string): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-CO');
  }

}
