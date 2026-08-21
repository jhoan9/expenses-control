import { query, queryOne, execute, transaction } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { PoolClient } from 'pg';

interface Investment {
  id: number;
  user_id: number;
  name: string;
  ticker: string | null;
  exchange: string | null;
  type: 'stock' | 'bond' | 'etf' | 'crypto' | 'other';
  created_at: Date;
  updated_at: Date;
}

interface Position {
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
}

interface CreateInvestmentDTO {
  name: string;
  ticker?: string;
  exchange?: string;
  type: 'stock' | 'bond' | 'etf' | 'crypto' | 'other';
}

interface CreatePositionDTO {
  account_id: number;
  quantity: number;
  unit_price: number;
  commission?: number;
  date?: string;
  notes?: string;
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
  async findAll(userId: number): Promise<Investment[]> {
    return query<Investment>(
      'SELECT * FROM investments WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name',
      [userId]
    );
  }

  async findById(id: number, userId: number): Promise<Investment & { positions: Position[]; open_quantity: number; avg_cost: number }> {
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

    const openBuys = positions.filter(p => p.type === 'buy' && Number(p.remaining_quantity) > 0);
    const open_quantity = Math.round(openBuys.reduce((sum, p) => sum + Number(p.remaining_quantity), 0) * 1e8) / 1e8;

    const costBasis = openBuys.reduce((sum, p) => {
      const qty = Number(p.quantity);
      const rem = Number(p.remaining_quantity);
      const frac = qty > 0 ? rem / qty : 0;
      return sum + Number(p.unit_price) * rem + Number(p.commission) * frac;
    }, 0);

    const avg_cost = open_quantity > 0 ? Math.round((costBasis / open_quantity) * 100) / 100 : 0;

    return { ...investment, positions, open_quantity, avg_cost };
  }

  async create(userId: number, data: CreateInvestmentDTO): Promise<Investment> {
    const result = await execute(
      'INSERT INTO investments (user_id, name, ticker, exchange, type) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, data.name, data.ticker || null, data.exchange || null, data.type]
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
        'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          data.account_id,
          'investment_buy',
          totalCost,
          Number(account.balance),
          newBalance,
          'position',
          positionId,
          `Buy ${data.quantity} ${investment.name} @ ${data.unit_price}`,
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

      const openBuysResult = await execute(
        "SELECT * FROM positions WHERE investment_id = $1 AND user_id = $2 AND type = 'buy' AND COALESCE(remaining_quantity, quantity) > 0 ORDER BY opened_at ASC, id ASC",
        [investmentId, userId],
        client
      );
      const lots = openBuysResult.rows.map((r: any) => ({
        id: r.id,
        quantity: Number(r.quantity),
        remaining: Number(r.remaining_quantity ?? r.quantity),
      }));

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
        'INSERT INTO positions (investment_id, user_id, type, quantity, remaining_quantity, unit_price, commission, total_cost, status, closed_at, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10) RETURNING id',
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
        'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          data.account_id,
          'investment_sell',
          totalRevenue,
          Number(account.balance),
          newBalance,
          'position',
          positionId,
          `Sell ${data.quantity} ${investment.name} @ ${data.unit_price}`,
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

    interface Lot {
      buy: Position;
      remaining: number;
      sells: OperationSellAllocation[];
    }
    const lots: Lot[] = [];

    for (const p of positions) {
      if (p.type === 'buy') {
        lots.push({ buy: p, remaining: Number(p.remaining_quantity ?? p.quantity), sells: [] });
      } else {
        let pending = Number(p.quantity);
        for (const lot of lots) {
          if (pending <= 0) break;
          if (lot.remaining <= 0) continue;
          const take = Math.min(lot.remaining, pending);
          const buyQty = Number(lot.buy.quantity);
          const buyFrac = buyQty > 0 ? take / buyQty : 0;
          const sellQty = Number(p.quantity);
          const sellFrac = sellQty > 0 ? take / sellQty : 0;
          const buyCostPortion = Number(lot.buy.unit_price) * take + Number(lot.buy.commission) * buyFrac;
          const sellValuePortion = Number(p.unit_price) * take - Number(p.commission) * sellFrac;
          lot.sells.push({
            sell_position_id: p.id,
            quantity: take,
            unit_price: Number(p.unit_price),
            commission: Math.round(Number(p.commission) * sellFrac * 100) / 100,
            opened_at: p.opened_at,
            total_value: Math.round(sellValuePortion * 100) / 100,
            realized_pnl: Math.round((sellValuePortion - buyCostPortion) * 100) / 100,
          });
          lot.remaining = Math.round((lot.remaining - take) * 1e8) / 1e8;
          pending -= take;
        }
      }
    }

    return lots.map(lot => {
      const sold_quantity = Math.round(lot.sells.reduce((s, a) => s + a.quantity, 0) * 1e8) / 1e8;
      const realized_pnl = Math.round(lot.sells.reduce((s, a) => s + a.realized_pnl, 0) * 100) / 100;
      const totalSoldValue = lot.sells.reduce((s, a) => s + a.total_value, 0);
      const isClosed = Number(lot.buy.remaining_quantity) <= 0;
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
        avg_sell_price: sold_quantity > 0 ? Math.round((totalSoldValue / sold_quantity) * 100) / 100 : 0,
        realized_pnl,
        status: isClosed ? ('closed' as const) : ('open' as const),
        closed_at: isClosed ? lot.buy.closed_at : null,
        notes: lot.buy.notes,
      };
    }).sort((a, b) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime());
  }

  async getOpenPositions(userId: number): Promise<any[]> {
    return query(
      `SELECT
        i.id as investment_id,
        i.name,
        i.ticker,
        i.type,
        COALESCE(SUM(CASE WHEN p.type = 'buy' THEN COALESCE(p.remaining_quantity, p.quantity) ELSE 0 END), 0) as open_quantity,
        COALESCE(SUM(CASE WHEN p.type = 'buy' THEN p.unit_price * COALESCE(p.remaining_quantity, p.quantity) + p.commission * (COALESCE(p.remaining_quantity, p.quantity) / NULLIF(p.quantity, 0)) ELSE 0 END), 0) as cost_basis,
        COUNT(CASE WHEN p.type = 'buy' AND p.status = 'open' THEN 1 END) as position_count
       FROM investments i
       LEFT JOIN positions p ON i.id = p.investment_id AND p.user_id = $1
       WHERE i.user_id = $2 AND i.deleted_at IS NULL
       GROUP BY i.id, i.name, i.ticker, i.type
       HAVING COALESCE(SUM(CASE WHEN p.type = 'buy' THEN COALESCE(p.remaining_quantity, p.quantity) ELSE 0 END), 0) > 0
       ORDER BY i.name`,
      [userId, userId]
    );
  }

  async getClosedPositions(userId: number): Promise<any[]> {
    return query(
      `SELECT
        i.id as investment_id,
        i.name,
        i.ticker,
        i.type,
        COALESCE(SUM(CASE WHEN p.type = 'buy' THEN p.quantity ELSE 0 END), 0) as bought_quantity,
        COALESCE(SUM(CASE WHEN p.type = 'sell' THEN p.quantity ELSE 0 END), 0) as sold_quantity,
        COALESCE(SUM(CASE WHEN p.type = 'buy' THEN p.total_cost ELSE 0 END), 0) as bought_value,
        COALESCE(SUM(CASE WHEN p.type = 'sell' THEN p.total_cost ELSE 0 END), 0) as sold_value,
        MAX(p.closed_at) as closed_at
       FROM investments i
       LEFT JOIN positions p ON i.id = p.investment_id AND p.user_id = $1
       WHERE i.user_id = $2 AND i.deleted_at IS NULL
       GROUP BY i.id, i.name, i.ticker, i.type
       HAVING COALESCE(SUM(CASE WHEN p.type = 'buy' THEN COALESCE(p.remaining_quantity, p.quantity) ELSE 0 END), 0) <= 0
         AND COUNT(p.id) > 0
       ORDER BY MAX(p.closed_at) DESC`,
      [userId, userId]
    );
  }
}

export const investmentsService = new InvestmentsService();
