import { PoolClient } from 'pg';
import { query, queryOne, execute, transaction } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';

interface Credit {
  id: number;
  user_id: number;
  institution: string;
  credit_limit: number;
  balance: number;
  due_date: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CreditPayment {
  id: number;
  credit_id: number;
  amount: number;
  minimum_payment: number | null;
  date: string;
  created_at: Date;
}

interface CreditWithPayments extends Credit {
  payments?: CreditPayment[];
  available_credit?: number;
}

interface CreateCreditDTO {
  institution: string;
  credit_limit: number;
  balance?: number;
  due_date?: string;
}

interface CreatePaymentDTO {
  amount: number;
  minimum_payment?: number;
  date: string;
}

export class CreditsService {
  async findAll(userId: number): Promise<Credit[]> {
    return query<Credit>(
      'SELECT * FROM credits WHERE user_id = $1 AND deleted_at IS NULL ORDER BY institution',
      [userId]
    );
  }

  async findById(id: number, userId: number): Promise<CreditWithPayments> {
    const credit = await queryOne<Credit>(
      'SELECT * FROM credits WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId]
    );

    if (!credit) {
      throw AppError.notFound('Credit not found');
    }

    const payments = await query<CreditPayment>(
      'SELECT * FROM credit_payments WHERE credit_id = $1 ORDER BY date DESC',
      [id]
    );

    const available_credit = credit.credit_limit - credit.balance;

    return { ...credit, payments, available_credit };
  }

  async create(userId: number, data: CreateCreditDTO): Promise<Credit> {
    const result = await execute(
      'INSERT INTO credits (user_id, institution, credit_limit, balance, due_date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, data.institution, data.credit_limit, data.balance || 0, data.due_date || null]
    );

    return queryOne<Credit>(
      'SELECT * FROM credits WHERE id = $1',
      [result.rows[0].id]
    ) as Promise<Credit>;
  }

  async update(id: number, userId: number, data: Partial<CreateCreditDTO>): Promise<Credit> {
    await this.findById(id, userId);

    const fields: string[] = [];
    const values: any[] = [];

    if (data.institution !== undefined) {
      fields.push(`institution = $${values.length + 1}`);
      values.push(data.institution);
    }
    if (data.credit_limit !== undefined) {
      fields.push(`credit_limit = $${values.length + 1}`);
      values.push(data.credit_limit);
    }
    if (data.balance !== undefined) {
      fields.push(`balance = $${values.length + 1}`);
      values.push(data.balance);
    }
    if (data.due_date !== undefined) {
      fields.push(`due_date = $${values.length + 1}`);
      values.push(data.due_date);
    }

    if (fields.length === 0) {
      return queryOne<Credit>(
        'SELECT * FROM credits WHERE id = $1',
        [id]
      ) as Promise<Credit>;
    }

    values.push(id);
    await execute(
      `UPDATE credits SET ${fields.join(', ')} WHERE id = $${values.length} AND deleted_at IS NULL`,
      values
    );

    return queryOne<Credit>(
      'SELECT * FROM credits WHERE id = $1',
      [id]
    ) as Promise<Credit>;
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await execute('UPDATE credits SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  async addPayment(creditId: number, userId: number, data: CreatePaymentDTO): Promise<CreditPayment> {
    return transaction(async (client: PoolClient) => {
      const credit = await queryOne<Credit>(
        'SELECT * FROM credits WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [creditId, userId],
        client
      );

      if (!credit) {
        throw AppError.notFound('Credit not found');
      }

      const newBalance = credit.balance - data.amount;
      if (newBalance < 0) {
        throw AppError.badRequest('Payment exceeds balance');
      }

      const result = await execute(
        'INSERT INTO credit_payments (credit_id, amount, minimum_payment, date) VALUES ($1, $2, $3, $4) RETURNING id',
        [creditId, data.amount, data.minimum_payment || null, data.date],
        client
      );

      await execute(
        'UPDATE credits SET balance = $1 WHERE id = $2',
        [newBalance, creditId],
        client
      );

      return queryOne<CreditPayment>(
        'SELECT * FROM credit_payments WHERE id = $1',
        [result.rows[0].id],
        client
      ) as Promise<CreditPayment>;
    });
  }

  async deletePayment(id: number, creditId: number, userId: number): Promise<void> {
    return transaction(async (client: PoolClient) => {
      const credit = await queryOne<Credit>(
        'SELECT * FROM credits WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [creditId, userId],
        client
      );

      if (!credit) {
        throw AppError.notFound('Credit not found');
      }

      const payment = await queryOne<CreditPayment>(
        'SELECT * FROM credit_payments WHERE id = $1 AND credit_id = $2',
        [id, creditId],
        client
      );

      if (!payment) {
        throw AppError.notFound('Payment not found');
      }

      const newBalance = credit.balance + payment.amount;

      await execute('DELETE FROM credit_payments WHERE id = $1', [id], client);

      await execute(
        'UPDATE credits SET balance = $1 WHERE id = $2',
        [newBalance, creditId],
        client
      );
    });
  }

  async getSummary(userId: number): Promise<any> {
    const credits = await query<Credit>(
      'SELECT * FROM credits WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    let totalLimit = 0;
    let totalBalance = 0;

    for (const credit of credits) {
      totalLimit += Number(credit.credit_limit);
      totalBalance += Number(credit.balance);
    }

    return {
      total_credits: credits.length,
      total_limit: totalLimit,
      total_balance: totalBalance,
      total_available: totalLimit - totalBalance,
    };
  }
}

export const creditsService = new CreditsService();
