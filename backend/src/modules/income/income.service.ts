import { query, queryOne, execute, transaction } from '../../config/database';
import { PoolClient } from 'pg';
import { AppError } from '../../shared/errors/AppError';

interface Income {
  id: number;
  user_id: number;
  account_id: number;
  category_id: number | null;
  loan_id: number | null;
  amount: number;
  description: string | null;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

interface CreateIncomeDTO {
  account_id: number;
  category_id?: number;
  loan_id?: number | null;
  amount: number;
  description?: string;
  date: string;
  status?: 'pending' | 'completed' | 'cancelled';
}

interface UpdateIncomeDTO {
  account_id?: number;
  category_id?: number;
  loan_id?: number | null;
  amount?: number;
  description?: string;
  date?: string;
  status?: 'pending' | 'completed' | 'cancelled';
}

interface IncomeFilters {
  date_from?: string;
  date_to?: string;
  category_id?: number;
  account_id?: number;
  status?: string;
  loan_id?: number;
}

export class IncomeService {
  async findAll(
    userId: number,
    filters: IncomeFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{ income: Income[]; total: number; totalAmount: number }> {
    const offset = (page - 1) * limit;
    let sql =
      'SELECT i.*, l.borrower_name as loan_borrower FROM income i LEFT JOIN loans l ON i.loan_id = l.id WHERE i.user_id = $1 AND i.deleted_at IS NULL';
    const params: any[] = [userId];
    let paramIndex = 2;

    if (filters.date_from) {
      sql += ` AND i.date >= $${paramIndex++}`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND i.date <= $${paramIndex++}`;
      params.push(filters.date_to);
    }
    if (filters.category_id) {
      sql += ` AND i.category_id = $${paramIndex++}`;
      params.push(filters.category_id);
    }
    if (filters.account_id) {
      sql += ` AND i.account_id = $${paramIndex++}`;
      params.push(filters.account_id);
    }
    if (filters.status) {
      sql += ` AND i.status = $${paramIndex++}`;
      params.push(filters.status);
    }
    if (filters.loan_id) {
      sql += ` AND i.loan_id = $${paramIndex++}`;
      params.push(filters.loan_id);
    }

    const countSql = sql.replace(
      'SELECT i.*, l.borrower_name as loan_borrower',
      'SELECT COUNT(*) as total, COALESCE(SUM(i.amount), 0) as totalAmount'
    );
    const countResult = await queryOne<{ total: number; totalAmount: number }>(countSql, params);
    const total = countResult?.total || 0;
    const totalAmount = Number(countResult?.totalAmount || 0);

    sql += ` ORDER BY i.date DESC, i.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const income = await query<Income>(sql, params);

    return { income, total, totalAmount };
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

      let loan: any = null;
      if (data.loan_id) {
        loan = await queryOne<any>(
          'SELECT id, amount, status, borrower_name FROM loans WHERE id = $1 AND lender_id = $2 AND deleted_at IS NULL',
          [data.loan_id, userId],
          client
        );
        if (!loan) {
          throw AppError.notFound('Loan not found');
        }
      }

      const status = data.status || (loan ? 'pending' : 'completed');

      const newBalance = Number(account.balance) + Number(data.amount);

      const result = await execute(
        'INSERT INTO income (user_id, account_id, category_id, loan_id, amount, description, date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
        [
          userId,
          data.account_id,
          data.category_id || null,
          loan ? data.loan_id : null,
          data.amount,
          data.description || null,
          data.date,
          status,
        ],
        client
      );

      const insertId = result.rows[0].id;

      await execute(
        'UPDATE accounts SET balance = $1 WHERE id = $2',
        [newBalance, data.account_id],
        client
      );

      await execute(
        'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [data.account_id, 'income', data.amount, Number(account.balance), newBalance, 'income', insertId, data.description || null, data.date],
        client
      );

      if (loan) {
        await execute(
          'INSERT INTO loan_payments (loan_id, amount, description, date, income_id) VALUES ($1, $2, $3, $4, $5)',
          [loan.id, data.amount, data.description || `Abono de ${loan.borrower_name || 'préstamo'}`, data.date, insertId],
          client
        );

        const { paid } = await this.syncLoanFromPayments(loan.id, client);
        if (paid) {
          await execute('UPDATE income SET status = \'completed\' WHERE id = $1', [insertId], client);
        }
      }

      return this.findById(insertId, userId, client);
    });
  }

  async update(id: number, userId: number, data: UpdateIncomeDTO): Promise<Income> {
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
      if (data.loan_id !== undefined) {
        fields.push(`loan_id = $${fields.length + 1}`);
        values.push(data.loan_id);
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

      const finalBalance = await queryOne<any>(
        'SELECT balance FROM accounts WHERE id = $1',
        [newAccountId],
        client
      );
      const balanceAfter = Number(finalBalance?.balance || 0);
      const balanceBefore = balanceAfter - Number(newAmount);

      await execute(
        `UPDATE account_movements
         SET account_id = $1, amount = $2, description = $3, date = $4,
             balance_before = $5, balance_after = $6
         WHERE reference_type = 'income' AND reference_id = $7`,
        [
          newAccountId,
          Number(newAmount),
          data.description !== undefined ? data.description : existing.description,
          data.date !== undefined ? data.date : existing.date,
          balanceBefore,
          balanceAfter,
          id,
        ],
        client
      );

      await this.syncIncomeLoan(client, id, existing, data);

      return this.findById(id, userId, client);
    });
  }

  async delete(id: number, userId: number): Promise<void> {
    return transaction(async (client: PoolClient) => {
      const existing = await this.findById(id, userId, client);

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

      if (existing.loan_id) {
        await execute(
          'DELETE FROM loan_payments WHERE income_id = $1 AND loan_id = $2',
          [id, existing.loan_id],
          client
        );
        await this.syncLoanFromPayments(existing.loan_id, client);
      }

      await execute(
        'DELETE FROM account_movements WHERE reference_type = \'income\' AND reference_id = $1',
        [id],
        client
      );

      await execute(
        'UPDATE income SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id],
        client
      );
    });
  }

  private async syncLoanFromPayments(loanId: number, client: PoolClient): Promise<{ paid: boolean }> {
    const loan = await queryOne<any>(
      'SELECT id, amount, status FROM loans WHERE id = $1 AND deleted_at IS NULL',
      [loanId],
      client
    );

    if (!loan) {
      return { paid: false };
    }

    const totals = await queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM loan_payments WHERE loan_id = $1',
      [loanId],
      client
    );

    const paid = Number(totals?.total || 0) >= Number(loan.amount);
    const newStatus = paid ? 'paid' : 'active';

    if (loan.status !== newStatus) {
      await execute(
        'UPDATE loans SET status = $1 WHERE id = $2',
        [newStatus, loanId],
        client
      );
    }

    return { paid };
  }

  private async syncIncomeLoan(
    client: PoolClient,
    incomeId: number,
    existing: Income,
    data: UpdateIncomeDTO
  ): Promise<void> {
    const oldLoanId = existing.loan_id;
    const newLoanId = data.loan_id !== undefined ? data.loan_id : existing.loan_id;
    const amount = data.amount !== undefined ? data.amount : existing.amount;
    const description = data.description !== undefined ? data.description : existing.description;
    const date = data.date !== undefined ? data.date : existing.date;

    if (oldLoanId) {
      if (newLoanId === oldLoanId) {
        await execute(
          'UPDATE loan_payments SET amount = $1, description = $2, date = $3 WHERE income_id = $4 AND loan_id = $5',
          [amount, description, date, incomeId, oldLoanId],
          client
        );
        await this.syncLoanFromPayments(oldLoanId, client);
      } else {
        await execute(
          'DELETE FROM loan_payments WHERE income_id = $1 AND loan_id = $2',
          [incomeId, oldLoanId],
          client
        );
        await this.syncLoanFromPayments(oldLoanId, client);

        if (newLoanId) {
          const loan = await queryOne<any>(
            'SELECT id FROM loans WHERE id = $1 AND lender_id = $2 AND deleted_at IS NULL',
            [newLoanId, existing.user_id],
            client
          );
          if (!loan) {
            throw AppError.notFound('Loan not found');
          }
          await execute(
            'INSERT INTO loan_payments (loan_id, amount, description, date, income_id) VALUES ($1, $2, $3, $4, $5)',
            [newLoanId, amount, description, date, incomeId],
            client
          );
          await this.syncLoanFromPayments(newLoanId, client);
        }
      }
    } else if (newLoanId) {
      const loan = await queryOne<any>(
        'SELECT id FROM loans WHERE id = $1 AND lender_id = $2 AND deleted_at IS NULL',
        [newLoanId, existing.user_id],
        client
      );
      if (!loan) {
        throw AppError.notFound('Loan not found');
      }
      await execute(
        'INSERT INTO loan_payments (loan_id, amount, description, date, income_id) VALUES ($1, $2, $3, $4, $5)',
        [newLoanId, amount, description, date, incomeId],
        client
      );
      await this.syncLoanFromPayments(newLoanId, client);
    }

    if (newLoanId && data.status === undefined) {
      const loanInfo = await queryOne<any>(
        'SELECT status FROM loans WHERE id = $1',
        [newLoanId],
        client
      );
      if (loanInfo?.status === 'paid') {
        await execute('UPDATE income SET status = \'completed\' WHERE id = $1', [incomeId], client);
      }
    }
  }
}

export const incomeService = new IncomeService();