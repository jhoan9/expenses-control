import { query, queryOne, execute, transaction } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { PoolClient } from 'pg';

interface Investment {
  id: number;
  user_id: number;
  name: string;
  ticker: string | null;
  exchange: string | null;
  type: 'stock' | 'bond' | 'etf' | 'crypto' | 'land' | 'other';
  target_value: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface Position {
  id: number;
  investment_id: number;
  user_id: number;
  type: 'buy' | 'sell';
  quantity: number;
  remaining_quantity: number | null;
  unit_price: number;
  commission: number;
  total_cost: number;
  status: 'open' | 'closed';
  opened_at: Date;
  closed_at: Date | null;
  notes: string | null;
  buy_position_id: number | null;
}

interface CreateInvestmentDTO {
  name: string;
  ticker?: string;
  exchange?: string;
  type: 'stock' | 'bond' | 'etf' | 'crypto' | 'land' | 'other';
  target_value?: number;
}

interface CreateAbonoDTO {
  amount: number;
  date: string;
  notes?: string;
}

export interface Abono {
  id: number;
  investment_id: number;
  user_id: number;
  amount: number;
  date: string;
  notes: string | null;
  created_at: Date;
}

interface CreatePositionDTO {
  account_id: number;
  quantity: number;
  unit_price: number;
  commission?: number;
  notes?: string;
  date?: string;
  position_id?: number;
}

export interface OperationSellAllocation {
  sell_position_id: number;
  quantity: number;
  unit_price: number;
  commission: number;
  opened_at: Date;
  total_value: number;
  realized_pnl: number;
}

export interface FifoLot {
  buy: Position;
  remaining: number;
  sells: OperationSellAllocation[];
}

// Reproduce el historial completo de posiciones en orden FIFO y devuelve
// los lotes de compra con su cantidad restante y las ventas asignadas.
// Si un sell tiene buy_position_id, se asigna solo a ese lote (venta dirigida).
export function buildFifoLots(positions: Position[]): FifoLot[] {
  const sorted = [...positions].sort(
    (a, b) => new Date(a.opened_at).getTime() - new Date(b.opened_at).getTime() || a.id - b.id
  );
  const lots: FifoLot[] = [];

  for (const p of sorted) {
    if (p.type === 'buy') {
      lots.push({ buy: p, remaining: Number(p.quantity), sells: [] });
    } else {
      const buyQty = Number(p.quantity);

      // Venta dirigida: asignar SOLO al lote referenciado
      if (p.buy_position_id) {
        const lot = lots.find(l => l.buy.id === p.buy_position_id);
        if (lot && lot.remaining > 0) {
          const take = Math.min(lot.remaining, buyQty);
          const lotBuyQty = Number(lot.buy.quantity);
          const lotFrac = lotBuyQty > 0 ? take / lotBuyQty : 0;
          const sellFrac = buyQty > 0 ? take / buyQty : 0;
          lot.sells.push({
            sell_position_id: p.id,
            quantity: take,
            unit_price: Number(p.unit_price),
            commission: Math.round(Number(p.commission) * sellFrac * 100000) / 100000,
            opened_at: p.opened_at,
            total_value: Math.round((Number(p.unit_price) * take - Number(p.commission) * sellFrac) * 100000) / 100000,
            realized_pnl: Math.round((Number(p.unit_price) * take - Number(p.commission) * sellFrac - (Number(lot.buy.unit_price) * take + Number(lot.buy.commission) * lotFrac)) * 100000) / 100000,
          });
          lot.remaining = Math.round((lot.remaining - take) * 1e8) / 1e8;
        }
        continue;
      }

      // Venta FIFO: asignar desde el lote más antiguo
      let pending = buyQty;
      for (const lot of lots) {
        if (pending <= 0) break;
        if (lot.remaining <= 0) continue;
        const take = Math.min(lot.remaining, pending);
        const lotBuyQty = Number(lot.buy.quantity);
        const lotFrac = lotBuyQty > 0 ? take / lotBuyQty : 0;
        const sellFrac = buyQty > 0 ? take / buyQty : 0;
        const buyCostPortion = Number(lot.buy.unit_price) * take + Number(lot.buy.commission) * lotFrac;
        const sellValuePortion = Number(p.unit_price) * take - Number(p.commission) * sellFrac;
        lot.sells.push({
          sell_position_id: p.id,
          quantity: take,
          unit_price: Number(p.unit_price),
          commission: Math.round(Number(p.commission) * sellFrac * 100000) / 100000,
          opened_at: p.opened_at,
          total_value: Math.round(sellValuePortion * 100000) / 100000,
          realized_pnl: Math.round((sellValuePortion - buyCostPortion) * 100000) / 100000,
        });
        lot.remaining = Math.round((lot.remaining - take) * 1e8) / 1e8;
        pending -= take;
      }
    }
  }

  return lots;
}

export interface Operation {
  buy_position_id: number;
  opened_at: Date;
  quantity: number;
  unit_price: number;
  commission: number;
  total_cost: number;
  sold_quantity: number;
  remaining_quantity: number;
  sells: OperationSellAllocation[];
  avg_sell_price: number;
  realized_pnl: number;
  status: 'open' | 'closed';
  closed_at: Date | null;
  notes: string | null;
}

export class InvestmentsService {
  private lastSellAt(sells: OperationSellAllocation[]): Date | null {
    if (sells.length === 0) return null;
    return sells[sells.length - 1].opened_at;
  }

  private buildLots(positions: Position[]): FifoLot[] {
    return buildFifoLots(positions);
  }

  async findAll(userId: number): Promise<Investment[]> {
    return query<Investment>(
      'SELECT * FROM investments WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name',
      [userId]
    );
  }

  async findById(id: number, userId: number): Promise<Investment & { positions: Position[]; open_quantity: number; avg_cost: number; lots: any[]; abonos: Abono[]; total_abonado: number; remaining_value: number }> {
    const investment = await queryOne<Investment>(
      'SELECT * FROM investments WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId]
    );

    if (!investment) {
      throw AppError.notFound('Investment not found');
    }

    const positions = await query<Position>(
      'SELECT * FROM positions WHERE investment_id = $1 AND user_id = $2 ORDER BY opened_at ASC, id ASC',
      [id, userId]
    );

    const abonos = await query<Abono>(
      'SELECT * FROM investment_abonos WHERE investment_id = $1 AND user_id = $2 ORDER BY date DESC, id DESC',
      [id, userId]
    );

    const total_abonado = Math.round(abonos.reduce((s, a) => s + Number(a.amount), 0) * 100000) / 100000;
    const remaining_value = investment.target_value != null
      ? Math.round((Number(investment.target_value) - total_abonado) * 100000) / 100000
      : 0;

    // El saldo abierto se calcula reproduciendo el historial FIFO completo,
    // no con el campo almacenado (puede estar desactualizado en datos viejos)
    const lots = this.buildLots(positions);
    const openLots = lots.filter(l => l.remaining > 0);

    const open_quantity = Math.round(openLots.reduce((sum, l) => sum + l.remaining, 0) * 1e8) / 1e8;

    const costBasis = openLots.reduce((sum, l) => {
      const qty = Number(l.buy.quantity);
      const frac = qty > 0 ? l.remaining / qty : 0;
      return sum + Number(l.buy.unit_price) * l.remaining + Number(l.buy.commission) * frac;
    }, 0);

    const avg_cost = open_quantity > 0 ? Math.round((costBasis / open_quantity) * 100000) / 100000 : 0;

    const openLotList = openLots.map(l => ({
      id: l.buy.id,
      quantity: Number(l.buy.quantity),
      remaining: l.remaining,
      unit_price: Number(l.buy.unit_price),
      opened_at: l.buy.opened_at,
    }));

    return { ...investment, positions, open_quantity, avg_cost, lots: openLotList, abonos, total_abonado, remaining_value };
  }

  async create(userId: number, data: CreateInvestmentDTO): Promise<Investment> {
    const result = await execute(
      'INSERT INTO investments (user_id, name, ticker, exchange, type, target_value) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [userId, data.name, data.ticker || null, data.exchange || null, data.type, data.target_value ?? null]
    );

    return queryOne<Investment>(
      'SELECT * FROM investments WHERE id = $1',
      [result.rows[0].id]
    ) as Promise<Investment>;
  }

  async update(id: number, userId: number, data: Partial<CreateInvestmentDTO>): Promise<Investment> {
    await this.findById(id, userId);

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.ticker !== undefined) {
      fields.push(`ticker = $${paramIndex++}`);
      values.push(data.ticker);
    }
    if (data.exchange !== undefined) {
      fields.push(`exchange = $${paramIndex++}`);
      values.push(data.exchange);
    }
    if (data.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }
    if (data.target_value !== undefined) {
      fields.push(`target_value = $${paramIndex++}`);
      values.push(data.target_value ?? null);
    }

    if (fields.length === 0) {
      return queryOne<Investment>(
        'SELECT * FROM investments WHERE id = $1',
        [id]
      ) as Promise<Investment>;
    }

    values.push(id);
    await execute(
      `UPDATE investments SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
      values
    );

    return queryOne<Investment>(
      'SELECT * FROM investments WHERE id = $1',
      [id]
    ) as Promise<Investment>;
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await execute('UPDATE investments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2', [id, userId]);
  }

  async createAbono(investmentId: number, userId: number, data: CreateAbonoDTO): Promise<Abono> {
    const investment = await queryOne<Investment>(
      'SELECT * FROM investments WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [investmentId, userId]
    );

    if (!investment) {
      throw AppError.notFound('Investment not found');
    }

    const result = await execute(
      'INSERT INTO investment_abonos (investment_id, user_id, amount, date, notes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [investmentId, userId, data.amount, data.date, data.notes || null]
    );

    return queryOne<Abono>(
      'SELECT * FROM investment_abonos WHERE id = $1',
      [result.rows[0].id]
    ) as Promise<Abono>;
  }

  async deleteAbono(investmentId: number, abonoId: number, userId: number): Promise<void> {
    const investment = await queryOne<Investment>(
      'SELECT * FROM investments WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [investmentId, userId]
    );

    if (!investment) {
      throw AppError.notFound('Investment not found');
    }

    const abono = await queryOne<Abono>(
      'SELECT * FROM investment_abonos WHERE id = $1 AND investment_id = $2',
      [abonoId, investmentId]
    );

    if (!abono) {
      throw AppError.notFound('Abono not found');
    }

    await execute('DELETE FROM investment_abonos WHERE id = $1', [abonoId]);
  }

  async buy(investmentId: number, userId: number, data: CreatePositionDTO): Promise<Position> {
    return transaction(async (client: PoolClient) => {
      const investment = await queryOne<Investment>(
        'SELECT * FROM investments WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [investmentId, userId],
        client
      );

      if (!investment) {
        throw AppError.notFound('Investment not found');
      }

      const accountResult = await execute(
        'SELECT id, balance FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [data.account_id, userId],
        client
      );

      const accounts = accountResult.rows;
      if (accounts.length === 0) {
        throw AppError.notFound('Account not found');
      }

      const account = accounts[0];
      const totalCost = data.quantity * data.unit_price + (data.commission || 0);
      const accountBalance = Number(account.balance);

      if (accountBalance < totalCost) {
        throw AppError.badRequest('Insufficient balance');
      }

      const newBalance = accountBalance - totalCost;

      const result = await execute(
        'INSERT INTO positions (investment_id, user_id, type, quantity, remaining_quantity, unit_price, commission, total_cost, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
        [
          investmentId,
          userId,
          'buy',
          data.quantity,
          data.quantity,
          data.unit_price,
          data.commission || 0,
          totalCost,
          'open',
          data.notes || null,
        ],
        client
      );

      const positionId = result.rows[0].id;

      await execute(
        'UPDATE accounts SET balance = $1 WHERE id = $2',
        [newBalance, data.account_id],
        client
      );

      await execute(
        'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          data.account_id,
          'investment_buy',
          totalCost,
          Number(account.balance),
          newBalance,
          'position',
          positionId,
          `Buy ${data.quantity} ${investment.name} @ ${data.unit_price}`,
          data.date || null,
        ],
        client
      );

      return queryOne<Position>(
        'SELECT * FROM positions WHERE id = $1',
        [positionId],
        client
      ) as Promise<Position>;
    });
  }

  async sell(investmentId: number, userId: number, data: CreatePositionDTO): Promise<Position> {
    return transaction(async (client: PoolClient) => {
      const investment = await queryOne<Investment>(
        'SELECT * FROM investments WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [investmentId, userId],
        client
      );

      if (!investment) {
        throw AppError.notFound('Investment not found');
      }

      // Lotes abiertos calculados reproduciendo el historial FIFO completo
      const allPositions = await query<Position>(
        'SELECT * FROM positions WHERE investment_id = $1 AND user_id = $2 ORDER BY opened_at ASC, id ASC',
        [investmentId, userId],
        client
      );
      let lots = this.buildLots(allPositions)
        .filter(l => l.remaining > 0)
        .map(l => ({ id: l.buy.id, quantity: Number(l.buy.quantity), remaining: l.remaining }));

      // Venta dirigida: si se especifica position_id, solo se descuenta de ese lote
      if (data.position_id !== undefined && data.position_id !== null) {
        const target = lots.find(l => l.id === Number(data.position_id));
        if (!target) {
          throw AppError.badRequest('La posicion especificada no existe o ya esta cerrada');
        }
        if (target.remaining < data.quantity) {
          throw AppError.badRequest(
            `La posicion #${target.id} solo tiene ${target.remaining} unidades disponibles`
          );
        }
        lots = [target];
      }

      const totalOpenQuantity = lots.reduce((sum: number, l: any) => sum + l.remaining, 0);
      if (totalOpenQuantity < data.quantity) {
        throw AppError.badRequest('Insufficient quantity to sell');
      }

      const accountResult = await execute(
        'SELECT id, balance FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [data.account_id, userId],
        client
      );

      const accounts = accountResult.rows;
      if (accounts.length === 0) {
        throw AppError.notFound('Account not found');
      }

      const account = accounts[0];
      const totalRevenue = data.quantity * data.unit_price - (data.commission || 0);
      const newBalance = Number(account.balance) + totalRevenue;

      // FIFO: asignar la venta sobre los lotes abiertos
      let pending = data.quantity;
      const allocations: { lotId: number; take: number }[] = [];
      for (const lot of lots) {
        if (pending <= 0) break;
        const take = Math.min(lot.remaining, pending);
        allocations.push({ lotId: lot.id, take });
        pending -= take;
      }

      let fullyClosedLots = 0;
      for (const a of allocations) {
        const lot = lots.find(l => l.id === a.lotId)!;
        const after = Math.round((lot.remaining - a.take) * 1e8) / 1e8;
        lot.remaining = after;
        if (after <= 0) {
          fullyClosedLots++;
          await execute(
            "UPDATE positions SET remaining_quantity = 0, status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE id = $1",
            [a.lotId],
            client
          );
        } else {
          await execute(
            'UPDATE positions SET remaining_quantity = $1 WHERE id = $2',
            [after, a.lotId],
            client
          );
        }
      }

      const result = await execute(
        'INSERT INTO positions (investment_id, user_id, type, quantity, remaining_quantity, unit_price, commission, total_cost, status, closed_at, notes, buy_position_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, $11) RETURNING id',
        [
          investmentId,
          userId,
          'sell',
          data.quantity,
          0,
          data.unit_price,
          data.commission || 0,
          totalRevenue,
          'closed',
          data.notes || null,
          data.position_id || null,
        ],
        client
      );

      const positionId = result.rows[0].id;

      await execute(
        'UPDATE accounts SET balance = $1 WHERE id = $2',
        [newBalance, data.account_id],
        client
      );

      await execute(
        'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [
          data.account_id,
          'investment_sell',
          totalRevenue,
          Number(account.balance),
          newBalance,
          'position',
          positionId,
          `Sell ${data.quantity} ${investment.name} @ ${data.unit_price}`,
          data.date || null,
        ],
        client
      );

      return queryOne<Position>(
        'SELECT * FROM positions WHERE id = $1',
        [positionId],
        client
      ) as Promise<Position>;
    });
  }

  async getOperations(userId: number, investmentId: number): Promise<Operation[]> {
    const positions = await query<Position>(
      'SELECT * FROM positions WHERE investment_id = $1 AND user_id = $2 ORDER BY opened_at ASC, id ASC',
      [investmentId, userId]
    );

    const lots = this.buildLots(positions);

    return lots.map(lot => {
      const sold_quantity = Math.round(lot.sells.reduce((s, a) => s + a.quantity, 0) * 1e8) / 1e8;
      const realized_pnl = Math.round(lot.sells.reduce((s, a) => s + a.realized_pnl, 0) * 100000) / 100000;
      const totalSoldValue = lot.sells.reduce((s, a) => s + a.total_value, 0);
      // El estado se determina por el replay del historial, no por el valor almacenado,
      // para ser consistente incluso si hay datos previos al sistema FIFO
      const isClosed = lot.remaining <= 0;
      return {
        buy_position_id: lot.buy.id,
        opened_at: lot.buy.opened_at,
        quantity: Number(lot.buy.quantity),
        unit_price: Number(lot.buy.unit_price),
        commission: Number(lot.buy.commission),
        total_cost: Number(lot.buy.total_cost),
        sold_quantity,
        remaining_quantity: Math.round(lot.remaining * 1e8) / 1e8,
        sells: lot.sells,
        avg_sell_price: sold_quantity > 0 ? Math.round((totalSoldValue / sold_quantity) * 100000) / 100000 : 0,
        realized_pnl,
        status: isClosed ? ('closed' as const) : ('open' as const),
        closed_at: isClosed ? (lot.buy.closed_at ?? this.lastSellAt(lot.sells)) : null,
        notes: lot.buy.notes,
      };
    }).sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
  }

  async getOpenPositions(userId: number): Promise<any[]> {
    const investments = await query<any>(
      'SELECT * FROM investments WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name',
      [userId]
    );
    const positions = await query<Position>(
      'SELECT p.* FROM positions p JOIN investments i ON i.id = p.investment_id WHERE i.user_id = $1 AND i.deleted_at IS NULL ORDER BY p.opened_at ASC, p.id ASC',
      [userId]
    );

    const result: any[] = [];
    for (const inv of investments) {
      const invPositions = positions.filter(p => p.investment_id === inv.id);
      if (invPositions.length === 0) continue;

      const openLots = this.buildLots(invPositions).filter(l => l.remaining > 0);
      if (openLots.length === 0) continue;

      const open_quantity = Math.round(openLots.reduce((s, l) => s + l.remaining, 0) * 1e8) / 1e8;
      const cost_basis = Math.round(
        openLots.reduce((s, l) => {
          const qty = Number(l.buy.quantity);
          const frac = qty > 0 ? l.remaining / qty : 0;
          return s + Number(l.buy.unit_price) * l.remaining + Number(l.buy.commission) * frac;
        }, 0) * 100
      ) / 100;
      const avg_cost = open_quantity > 0 ? Math.round((cost_basis / open_quantity) * 100000) / 100000 : 0;

      result.push({
        investment_id: inv.id,
        name: inv.name,
        ticker: inv.ticker,
        type: inv.type,
        open_quantity,
        total_cost: cost_basis,
        avg_cost,
        position_count: openLots.length,
      });
    }

    return result;
  }

  async getClosedPositions(userId: number): Promise<any[]> {
    const investments = await query<any>(
      'SELECT * FROM investments WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name',
      [userId]
    );
    const positions = await query<Position>(
      'SELECT p.* FROM positions p JOIN investments i ON i.id = p.investment_id WHERE i.user_id = $1 AND i.deleted_at IS NULL ORDER BY p.opened_at ASC, p.id ASC',
      [userId]
    );

    const result: any[] = [];
    for (const inv of investments) {
      const invPositions = positions.filter(p => p.investment_id === inv.id);
      if (invPositions.length === 0) continue;

      const lots = this.buildLots(invPositions);
      // Cerrada solo si hubo ventas y no queda cantidad abierta en ningún lote
      const hasSells = lots.some(l => l.sells.length > 0);
      const openRemaining = lots.reduce((s, l) => s + Math.max(l.remaining, 0), 0);
      if (!hasSells || openRemaining > 0) continue;

      const bought_quantity = Math.round(invPositions.filter(p => p.type === 'buy').reduce((s, p) => s + Number(p.quantity), 0) * 1e8) / 1e8;
      const sold_quantity = Math.round(invPositions.filter(p => p.type === 'sell').reduce((s, p) => s + Number(p.quantity), 0) * 1e8) / 1e8;
      const bought_value = Math.round(invPositions.filter(p => p.type === 'buy').reduce((s, p) => s + Number(p.total_cost), 0) * 100000) / 100000;
      const sold_value = Math.round(invPositions.filter(p => p.type === 'sell').reduce((s, p) => s + Number(p.total_cost), 0) * 100000) / 100000;

      const sellDates = lots.flatMap(l => l.sells.map(s => new Date(s.opened_at).getTime()));
      const closed_at = sellDates.length > 0 ? new Date(Math.max(...sellDates)) : null;

      result.push({
        investment_id: inv.id,
        name: inv.name,
        ticker: inv.ticker,
        type: inv.type,
        bought_quantity,
        sold_quantity,
        bought_value,
        sold_value,
        closed_at,
      });
    }

    result.sort((a, b) => new Date(b.closed_at).getTime() - new Date(a.closed_at).getTime());
    return result;
  }
}

export const investmentsService = new InvestmentsService();
