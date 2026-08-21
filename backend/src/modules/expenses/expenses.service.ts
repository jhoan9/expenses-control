import { query, queryOne, execute, transaction } from '../../config/database';
import { PoolClient } from 'pg';
import { AppError } from '../../shared/errors/AppError';

interface Expense {
  id: number;
  user_id: number;
  account_id: number;
  category_id: number | null;
  subcategory_id: number | null;
  payment_method_id: number | null;
  amount: number;
  description: string | null;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

interface CreateExpenseDTO {
  account_id: number;
  category_id?: number;
  subcategory_id?: number;
  payment_method_id?: number;
  amount: number;
  description?: string;
  date: string;
  status?: 'pending' | 'completed' | 'cancelled';
}

interface UpdateExpenseDTO {
  account_id?: number;
  category_id?: number;
  subcategory_id?: number;
  payment_method_id?: number;
  amount?: number;
  description?: string;
  date?: string;
  status?: 'pending' | 'completed' | 'cancelled';
}

interface ExpenseFilters {
  date_from?: string;
  date_to?: string;
  category_id?: number;
  subcategory_id?: number;
  account_id?: number;
  payment_method_id?: number;
  status?: string;
}

export class ExpensesService {
  async findAll(
    userId: number,
    filters: ExpenseFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ expenses: Expense[]; total: number }> {
    const offset = (page - 1) * limit;
    let sql = 'SELECT * FROM expenses WHERE user_id = $1 AND deleted_at IS NULL';
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
    if (filters.subcategory_id) {
      sql += ` AND subcategory_id = $${paramIndex++}`;
      params.push(filters.subcategory_id);
    }
    if (filters.account_id) {
      sql += ` AND account_id = $${paramIndex++}`;
      params.push(filters.account_id);
    }
    if (filters.payment_method_id) {
      sql += ` AND payment_method_id = $${paramIndex++}`;
      params.push(filters.payment_method_id);
    }
    if (filters.status) {
      sql += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const countResult = await queryOne<{ total: number }>(countSql, params);
    const total = countResult?.total || 0;

    sql += ` ORDER BY date DESC, created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const expenses = await query<Expense>(sql, params);

    return { expenses, total };
  }

  async findById(id: number, userId: number, client?: PoolClient): Promise<Expense> {
    const expense = await queryOne<Expense>(
      'SELECT * FROM expenses WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId],
      client
    );

    if (!expense) {
      throw AppError.notFound('Expense not found');
    }

    return expense;
  }

  async create(userId: number, data: CreateExpenseDTO): Promise<Expense> {
    return transaction(async (client: PoolClient) => {
      const account = await queryOne<any>(
        'SELECT id, balance FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [data.account_id, userId],
        client
      );

      if (!account) {
        throw AppError.notFound('Account not found');
      }

      if (data.status !== 'pending' && Number(account.balance) < Number(data.amount)) {
        throw AppError.badRequest('Insufficient balance');
      }

      const result = await execute(
        'INSERT INTO expenses (user_id, account_id, category_id, subcategory_id, payment_method_id, amount, description, date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
        [
          userId,
          data.account_id,
          data.category_id || null,
          data.subcategory_id || null,
          data.payment_method_id || null,
          data.amount,
          data.description || null,
          data.date,
          data.status || 'completed',
        ],
        client
      );

      const insertId = result.rows[0].id;

      if (data.status !== 'pending') {
        const newBalance = Number(account.balance) - Number(data.amount);

        await execute(
          'UPDATE accounts SET balance = $1 WHERE id = $2',
          [newBalance, data.account_id],
          client
        );

        await execute(
          'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [data.account_id, 'expense', data.amount, Number(account.balance), newBalance, 'expense', insertId, data.description || null],
          client
        );
      }

      return this.findById(insertId, userId, client);
    });
  }

  async update(id: number, userId: number, data: UpdateExpenseDTO): Promise<Expense> {
    return transaction(async (client: PoolClient) => {
      const existing = await this.findById(id, userId, client);

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
      if (data.subcategory_id !== undefined) {
        fields.push(`subcategory_id = $${fields.length + 1}`);
        values.push(data.subcategory_id);
      }
      if (data.payment_method_id !== undefined) {
        fields.push(`payment_method_id = $${fields.length + 1}`);
        values.push(data.payment_method_id);
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
      if (data.status !== undefined) {
        fields.push(`status = $${fields.length + 1}`);
        values.push(data.status);
      }

      if (fields.length === 0) {
        return existing;
      }

      const newAccountId = data.account_id !== undefined ? data.account_id : existing.account_id;
      const newAmount = data.amount !== undefined ? data.amount : existing.amount;
      const newStatus = data.status !== undefined ? data.status : existing.status;

      if (existing.status !== 'pending') {
        const oldAccount = await queryOne<any>(
          'SELECT balance FROM accounts WHERE id = $1',
          [existing.account_id],
          client
        );

        if (!oldAccount) {
          throw AppError.notFound('Account not found');
        }

        await execute(
          'UPDATE accounts SET balance = $1 WHERE id = $2',
          [Number(oldAccount.balance) + Number(existing.amount), existing.account_id],
          client
        );
      }

      if (newStatus !== 'pending') {
        const newAccount = await queryOne<any>(
          'SELECT balance FROM accounts WHERE id = $1',
          [newAccountId],
          client
        );

        if (!newAccount) {
          throw AppError.notFound('Account not found');
        }

        if (Number(newAccount.balance) < Number(newAmount)) {
          throw AppError.badRequest('Insufficient balance');
        }

        await execute(
          'UPDATE accounts SET balance = $1 WHERE id = $2',
          [Number(newAccount.balance) - Number(newAmount), newAccountId],
          client
        );
      }

      values.push(id);
      await execute(
        `UPDATE expenses SET ${fields.join(', ')} WHERE id = $${fields.length + 1} AND deleted_at IS NULL`,
        values,
        client
      );

      return this.findById(id, userId, client);
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    return transaction(async (client: PoolClient) => {
      const existing = await this.findById(id, userId, client);

      if (existing.status !== 'pending') {
        const account = await queryOne<any>(
          'SELECT balance FROM accounts WHERE id = $1',
          [existing.account_id],
          client
        );

        if (!account) {
          throw AppError.notFound('Account not found');
        }

        await execute(
          'UPDATE accounts SET balance = $1 WHERE id = $2',
          [Number(account.balance) + Number(existing.amount), existing.account_id],
          client
        );
      }

      await execute(
        'UPDATE expenses SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id],
        client
      );
    });
  }

  async getSummary(userId: number, dateFrom: string, dateTo: string): Promise<any> {
    const result = await queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = $1 AND deleted_at IS NULL AND status = 'completed' AND date >= $2 AND date <= $3",
      [userId, dateFrom, dateTo]
    );

    return {
      total: result?.total || 0,
      period: { from: dateFrom, to: dateTo },
    };
  }

  async getByCategory(userId: number, dateFrom: string, dateTo: string): Promise<any[]> {
    return query(
      `SELECT c.name as category, c.color, COALESCE(SUM(e.amount), 0) as total
       FROM categories c
       LEFT JOIN expenses e ON c.id = e.category_id AND e.user_id = $1 AND e.deleted_at IS NULL AND e.status = 'completed' AND e.date >= $2 AND e.date <= $3
       WHERE c.deleted_at IS NULL
       GROUP BY c.id, c.name, c.color
       ORDER BY total DESC`,
      [userId, dateFrom, dateTo]
    );
  }
}

export const expensesService = new ExpensesService();
