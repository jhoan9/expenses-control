import { query, queryOne, execute, transaction } from '../../config/database';
import { PoolClient } from 'pg';
import { AppError } from '../../shared/errors/AppError';

interface Income {
  id: number;
  user_id: number;
  account_id: number;
  category_id: number | null;
  amount: number;
  description: string | null;
  date: string;
  created_at: Date;
  updated_at: Date;
}

interface CreateIncomeDTO {
  account_id: number;
  category_id?: number;
  amount: number;
  description?: string;
  date: string;
}

interface UpdateIncomeDTO {
  account_id?: number;
  category_id?: number;
  amount?: number;
  description?: string;
  date?: string;
}

interface IncomeFilters {
  date_from?: string;
  date_to?: string;
  category_id?: number;
  account_id?: number;
}

export class IncomeService {
  async findAll(
    userId: number,
    filters: IncomeFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ income: Income[]; total: number }> {
    const offset = (page - 1) * limit;
    let sql = 'SELECT * FROM income WHERE user_id = $1 AND deleted_at IS NULL';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (filters.date_from) {
      sql += ` AND date >= $${paramIndex++}`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date <= $${paramIndex++}`;
      params.push(filters.date_to);
    }
    if (filters.category_id) {
      sql += ` AND category_id = $${paramIndex++}`;
      params.push(filters.category_id);
    }
    if (filters.account_id) {
      sql += ` AND account_id = $${paramIndex++}`;
      params.push(filters.account_id);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await queryOne<{ total: number }>(countSql, params);
    const total = countResult?.total || 0;

    sql += ` ORDER BY date DESC, created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const income = await query<Income>(sql, params);

    return { income, total };
  }

  async findById(id: number, userId: number, client?: PoolClient): Promise<Income> {
    const income = await queryOne<Income>(
      'SELECT * FROM income WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId],
      client
    );

    if (!income) {
      throw AppError.notFound('Income not found');
    }

    return income;
  }

  async create(userId: number, data: CreateIncomeDTO): Promise<Income> {
    return transaction(async (client: PoolClient) => {
      const account = await queryOne<any>(
        'SELECT id, balance FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [data.account_id, userId],
        client
      );

      if (!account) {
        throw AppError.notFound('Account not found');
      }

      const newBalance = Number(account.balance) + Number(data.amount);

      const result = await execute(
        'INSERT INTO income (user_id, account_id, category_id, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [userId, data.account_id, data.category_id || null, data.amount, data.description || null, data.date],
        client
      );

      const insertId = result.rows[0].id;

      await execute(
        'UPDATE accounts SET balance = $1 WHERE id = $2',
        [newBalance, data.account_id],
        client
      );

      await execute(
        'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [data.account_id, 'income', data.amount, Number(account.balance), newBalance, 'income', insertId, data.description || null],
        client
      );

      return this.findById(insertId, userId, client);
    });
  }

  async update(id: number, userId: number, data: UpdateIncomeDTO): Promise<Income> {
    return transaction(async (client: PoolClient) => {
      const existing = await this.findById(id, userId);

      const fields: string[] = [];
      const values: any[] = [];

      if (data.account_id !== undefined) {
        fields.push(`account_id = $${fields.length + 1}`);
        values.push(data.account_id);
      }
      if (data.category_id !== undefined) {
        fields.push(`category_id = $${fields.length + 1}`);
        values.push(data.category_id);
      }
      if (data.amount !== undefined) {
        fields.push(`amount = $${fields.length + 1}`);
        values.push(data.amount);
      }
      if (data.description !== undefined) {
        fields.push(`description = $${fields.length + 1}`);
        values.push(data.description);
      }
      if (data.date !== undefined) {
        fields.push(`date = $${fields.length + 1}`);
        values.push(data.date);
      }

      if (fields.length === 0) {
        return existing;
      }

      const newAccountId = data.account_id || existing.account_id;
      const newAmount = data.amount !== undefined ? data.amount : existing.amount;

      const oldAccount = await queryOne<any>(
        'SELECT balance FROM accounts WHERE id = $1',
        [existing.account_id],
        client
      );

      await execute(
        'UPDATE accounts SET balance = $1 WHERE id = $2',
        [Number(oldAccount.balance) - Number(existing.amount), existing.account_id],
        client
      );

      if (newAccountId !== existing.account_id) {
        const newAccount = await queryOne<any>(
          'SELECT balance FROM accounts WHERE id = $1',
          [newAccountId],
          client
        );

        await execute(
          'UPDATE accounts SET balance = $1 WHERE id = $2',
          [Number(newAccount.balance) + Number(newAmount), newAccountId],
          client
        );
      } else {
        const updatedBalance = Number(oldAccount.balance) - Number(existing.amount) + Number(newAmount);
        await execute(
          'UPDATE accounts SET balance = $1 WHERE id = $2',
          [updatedBalance, newAccountId],
          client
        );
      }

      values.push(id);
      await execute(
        `UPDATE income SET ${fields.join(', ')} WHERE id = $${fields.length + 1} AND deleted_at IS NULL`,
        values,
        client
      );

      return this.findById(id, userId, client);
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    return transaction(async (client: PoolClient) => {
      const existing = await this.findById(id, userId);

      const account = await queryOne<any>(
        'SELECT balance FROM accounts WHERE id = $1',
        [existing.account_id],
        client
      );

      await execute(
        'UPDATE accounts SET balance = $1 WHERE id = $2',
        [Number(account.balance) - Number(existing.amount), existing.account_id],
        client
      );

      await execute(
        'UPDATE income SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id],
        client
      );
    });
  }
}

export const incomeService = new IncomeService();
