import { PoolClient } from 'pg';
import { query, queryOne, execute, transaction } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';

interface Budget {
  id: number;
  user_id: number;
  period_type: 'first' | 'second';
  start_date: string;
  end_date: string;
  total_income: number;
  created_at: Date;
  updated_at: Date;
}

interface BudgetItem {
  id: number;
  budget_id: number;
  name: string;
  amount: number;
  due_date: string;
  paid_date: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  is_recurrent: boolean;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

interface BudgetWithItems extends Budget {
  items?: BudgetItem[];
}

interface CreateBudgetDTO {
  period_type: 'first' | 'second';
  start_date: string;
  end_date: string;
  total_income?: number;
}

interface CreateBudgetItemDTO {
  name: string;
  amount: number;
  due_date: string;
  is_recurrent?: boolean;
  notes?: string;
}

interface UpdateBudgetItemDTO {
  name?: string;
  amount?: number;
  due_date?: string;
  paid_date?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  is_recurrent?: boolean;
  notes?: string;
}

export class BudgetService {
  async findAll(userId: number): Promise<Budget[]> {
    return query<Budget>(
      'SELECT * FROM budgets WHERE user_id = $1 AND deleted_at IS NULL ORDER BY start_date DESC',
      [userId]
    );
  }

  async findById(id: number, userId: number): Promise<BudgetWithItems> {
    const budget = await queryOne<Budget>(
      'SELECT * FROM budgets WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId]
    );

    if (!budget) {
      throw AppError.notFound('Budget not found');
    }

    const items = await query<BudgetItem>(
      'SELECT * FROM budget_items WHERE budget_id = $1 AND deleted_at IS NULL ORDER BY due_date',
      [id]
    );

    return { ...budget, items };
  }

  async create(userId: number, data: CreateBudgetDTO): Promise<Budget> {
    const result = await execute(
      'INSERT INTO budgets (user_id, period_type, start_date, end_date, total_income) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, data.period_type, data.start_date, data.end_date, data.total_income || 0]
    );

    return this.findById(result.rows[0].id, userId) as Promise<Budget>;
  }

  async update(id: number, userId: number, data: Partial<CreateBudgetDTO>): Promise<Budget> {
    await this.findById(id, userId);

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.period_type !== undefined) {
      fields.push(`period_type = $${paramIndex++}`);
      values.push(data.period_type);
    }
    if (data.start_date !== undefined) {
      fields.push(`start_date = $${paramIndex++}`);
      values.push(data.start_date);
    }
    if (data.end_date !== undefined) {
      fields.push(`end_date = $${paramIndex++}`);
      values.push(data.end_date);
    }
    if (data.total_income !== undefined) {
      fields.push(`total_income = $${paramIndex++}`);
      values.push(data.total_income);
    }

    if (fields.length === 0) {
      return this.findById(id, userId) as Promise<Budget>;
    }

    values.push(id);
    await execute(
      `UPDATE budgets SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
      values
    );

    return this.findById(id, userId) as Promise<Budget>;
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await execute('UPDATE budgets SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  async addItem(budgetId: number, userId: number, data: CreateBudgetItemDTO): Promise<BudgetItem> {
    await this.findById(budgetId, userId);

    const result = await execute(
      'INSERT INTO budget_items (budget_id, name, amount, due_date, is_recurrent, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [budgetId, data.name, data.amount, data.due_date, data.is_recurrent || false, data.notes || null]
    );

    return queryOne<BudgetItem>(
      'SELECT * FROM budget_items WHERE id = $1',
      [result.rows[0].id]
    ) as Promise<BudgetItem>;
  }

  async updateItem(id: number, budgetId: number, userId: number, data: UpdateBudgetItemDTO): Promise<BudgetItem> {
    await this.findById(budgetId, userId);

    const item = await queryOne<BudgetItem>(
      'SELECT * FROM budget_items WHERE id = $1 AND budget_id = $2 AND deleted_at IS NULL',
      [id, budgetId]
    );

    if (!item) {
      throw AppError.notFound('Budget item not found');
    }

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.amount !== undefined) {
      fields.push(`amount = $${paramIndex++}`);
      values.push(data.amount);
    }
    if (data.due_date !== undefined) {
      fields.push(`due_date = $${paramIndex++}`);
      values.push(data.due_date);
    }
    if (data.paid_date !== undefined) {
      fields.push(`paid_date = $${paramIndex++}`);
      values.push(data.paid_date);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.is_recurrent !== undefined) {
      fields.push(`is_recurrent = $${paramIndex++}`);
      values.push(data.is_recurrent);
    }
    if (data.notes !== undefined) {
      fields.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }

    if (fields.length === 0) {
      return item;
    }

    values.push(id);
    await execute(
      `UPDATE budget_items SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
      values
    );

    return queryOne<BudgetItem>(
      'SELECT * FROM budget_items WHERE id = $1',
      [id]
    ) as Promise<BudgetItem>;
  }

  async deleteItem(id: number, budgetId: number, userId: number): Promise<void> {
    await this.findById(budgetId, userId);

    const item = await queryOne<BudgetItem>(
      'SELECT * FROM budget_items WHERE id = $1 AND budget_id = $2 AND deleted_at IS NULL',
      [id, budgetId]
    );

    if (!item) {
      throw AppError.notFound('Budget item not found');
    }

    await execute('UPDATE budget_items SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  async bulkUpdateItems(
    budgetId: number,
    userId: number,
    data: { total_income?: number; items: Array<Partial<CreateBudgetItemDTO> & { id?: number; status?: BudgetItem['status']; paid_date?: string | null }> }
  ): Promise<BudgetWithItems> {
    await this.findById(budgetId, userId);

    if (data.total_income !== undefined) {
      await execute(
        'UPDATE budgets SET total_income = $1 WHERE id = $2 AND user_id = $3',
        [data.total_income, budgetId, userId]
      );
    }

    for (const item of data.items || []) {
      if (item.id) {
        const fields: string[] = [];
        const values: any[] = [];

        if (item.name !== undefined) {
          fields.push(`name = $${fields.length + 1}`);
          values.push(item.name);
        }
        if (item.amount !== undefined) {
          fields.push(`amount = $${fields.length + 1}`);
          values.push(item.amount);
        }
        if (item.due_date !== undefined) {
          fields.push(`due_date = $${fields.length + 1}`);
          values.push(item.due_date);
        }
        if (item.status !== undefined) {
          fields.push(`status = $${fields.length + 1}`);
          values.push(item.status);
          if (item.status === 'completed' && item.paid_date === undefined) {
            fields.push(`paid_date = $${fields.length + 1}`);
            values.push(new Date().toISOString().split('T')[0]);
          }
          if (item.status !== 'completed') {
            fields.push(`paid_date = $${fields.length + 1}`);
            values.push(null);
          }
        }
        if (item.is_recurrent !== undefined) {
          fields.push(`is_recurrent = $${fields.length + 1}`);
          values.push(item.is_recurrent);
        }
        if (item.notes !== undefined) {
          fields.push(`notes = $${fields.length + 1}`);
          values.push(item.notes);
        }

        if (fields.length > 0) {
          fields.push(`updated_at = CURRENT_TIMESTAMP`);
          values.push(item.id, budgetId);
          await execute(
            `UPDATE budget_items SET ${fields.join(', ')} WHERE id = $${values.length - 1} AND budget_id = $${values.length} AND deleted_at IS NULL`,
            values
          );
        }
      } else if (item.name && item.amount != null) {
        await execute(
          'INSERT INTO budget_items (budget_id, name, amount, due_date, is_recurrent, notes) VALUES ($1, $2, $3, $4, $5, $6)',
          [budgetId, item.name, item.amount, item.due_date || new Date().toISOString().split('T')[0], item.is_recurrent || false, item.notes || null]
        );
      }
    }

    return this.findById(budgetId, userId);
  }

  async copyNext(budgetId: number, userId: number): Promise<BudgetWithItems> {
    const budget = await this.findById(budgetId, userId);

    const nextPeriodType: Budget['period_type'] = budget.period_type === 'first' ? 'second' : 'first';
    const nextStart = new Date(budget.end_date);
    nextStart.setDate(nextStart.getDate() + 1);
    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + 14);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    const result = await execute(
      'INSERT INTO budgets (user_id, period_type, start_date, end_date, total_income) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, nextPeriodType, formatDate(nextStart), formatDate(nextEnd), budget.total_income]
    );
    const newBudgetId = result.rows[0].id;

    const activeItems = (budget.items || []).filter(i => i.status !== 'cancelled');
    for (const item of activeItems) {
      await execute(
        'INSERT INTO budget_items (budget_id, name, amount, due_date, is_recurrent, notes) VALUES ($1, $2, $3, $4, $5, $6)',
        [newBudgetId, item.name, item.amount, item.due_date, item.is_recurrent, item.notes]
      );
    }

    return this.findById(newBudgetId, userId);
  }

  async getSummary(id: number, userId: number): Promise<any> {
    const budget = await this.findById(id, userId);

    const totals = await queryOne<{ total_planned: number; total_paid: number; total_pending: number }>(
      `SELECT
        COALESCE(SUM(amount), 0) as total_planned,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending
       FROM budget_items
       WHERE budget_id = $1 AND deleted_at IS NULL`,
      [id]
    );

    return {
      budget,
      summary: {
        total_income: budget.total_income,
        total_planned: totals?.total_planned || 0,
        total_paid: totals?.total_paid || 0,
        total_pending: totals?.total_pending || 0,
        remaining: (budget.total_income || 0) - (totals?.total_paid || 0),
      },
    };
  }
}

export const budgetService = new BudgetService();
