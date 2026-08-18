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
  unit_price: number;
  commission: number;
  total_cost: number;
  status: 'open' | 'closed';
  opened_at: Date;
  closed_at: Date | null;
  notes: string | null;
}

interface InvestmentWithPositions extends Investment {
  positions?: Position[];
  open_quantity?: number;
  avg_cost?: number;
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

export class InvestmentsService {
  async findAll(userId: number): Promise<Investment[]> {
    return query<Investment>(
      'SELECT * FROM investments WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name',
      [userId]
    );
  }

  async findById(id: number, userId: number): Promise<InvestmentWithPositions> {
    const investment = await queryOne<Investment>(
      'SELECT * FROM investments WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId]
    );

    if (!investment) {
      throw AppError.notFound('Investment not found');
    }

    const positions = await query<Position>(
      'SELECT * FROM positions WHERE investment_id = $1 AND user_id = $2 ORDER BY opened_at DESC',
      [id, userId]
    );

    const openPositions = positions.filter(p => p.status === 'open');
    const open_quantity = openPositions.reduce((sum, p) => {
      return sum + (p.type === 'buy' ? p.quantity : -p.quantity);
    }, 0);

    const totalCost = openPositions
      .filter(p => p.type === 'buy')
      .reduce((sum, p) => sum + p.total_cost, 0);
    const totalSold = openPositions
      .filter(p => p.type === 'sell')
      .reduce((sum, p) => sum + p.total_cost, 0);
    const avg_cost = open_quantity > 0 ? (totalCost - totalSold) / open_quantity : 0;

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
        'INSERT INTO positions (investment_id, user_id, type, quantity, unit_price, commission, total_cost, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
        [
          investmentId,
          userId,
          'buy',
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
          account.balance,
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

      const openBuys = await query<Position>(
        'SELECT * FROM positions WHERE investment_id = $1 AND user_id = $2 AND type = $3 AND status = $4',
        [investmentId, userId, 'buy', 'open'],
        client
      );

      const totalOpenQuantity = openBuys.reduce((sum, p) => sum + Number(p.quantity), 0);
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

      const result = await execute(
        'INSERT INTO positions (investment_id, user_id, type, quantity, unit_price, commission, total_cost, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
        [
          investmentId,
          userId,
          'sell',
          data.quantity,
          data.unit_price,
          data.commission || 0,
          totalRevenue,
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
          'investment_sell',
          totalRevenue,
          account.balance,
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

  async getOpenPositions(userId: number): Promise<any[]> {
    return query(
      `SELECT
        i.id as investment_id,
        i.name,
        i.ticker,
        i.type,
        COALESCE(SUM(CASE WHEN p.type = 'buy' THEN p.quantity ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN p.type = 'sell' THEN p.quantity ELSE 0 END), 0) as open_quantity,
        COALESCE(SUM(CASE WHEN p.type = 'buy' THEN p.total_cost ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN p.type = 'sell' THEN p.total_cost ELSE 0 END), 0) as total_cost,
        COUNT(CASE WHEN p.status = 'open' THEN 1 END) as position_count
       FROM investments i
       LEFT JOIN positions p ON i.id = p.investment_id AND p.user_id = $1
       WHERE i.user_id = $2 AND i.deleted_at IS NULL
       GROUP BY i.id, i.name, i.ticker, i.type
       HAVING COALESCE(SUM(CASE WHEN p.type = 'buy' THEN p.quantity ELSE 0 END), 0) -
              COALESCE(SUM(CASE WHEN p.type = 'sell' THEN p.quantity ELSE 0 END), 0) > 0
       ORDER BY i.name`,
      [userId, userId]
    );
  }
}

export const investmentsService = new InvestmentsService();
