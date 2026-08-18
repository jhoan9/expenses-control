import { PoolClient } from 'pg';
import { query, queryOne, execute, transaction } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';

interface Loan {
  id: number;
  lender_id: number;
  borrower_id: number | null;
  borrower_name: string | null;
  amount: number;
  description: string | null;
  date: string;
  status: 'active' | 'paid' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

interface LoanPayment {
  id: number;
  loan_id: number;
  amount: number;
  date: string;
  description: string | null;
  created_at: Date;
}

interface LoanWithPayments extends Loan {
  payments?: LoanPayment[];
  total_paid?: number;
  remaining?: number;
}

interface CreateLoanDTO {
  borrower_name: string;
  amount: number;
  description?: string;
  date: string;
}

interface CreatePaymentDTO {
  amount: number;
  description?: string;
  date: string;
}

export class LoansService {
  async findAll(userId: number): Promise<Loan[]> {
    return query<Loan>(
      'SELECT * FROM loans WHERE lender_id = $1 AND deleted_at IS NULL ORDER BY date DESC',
      [userId]
    );
  }

  async findById(id: number, userId: number): Promise<LoanWithPayments> {
    const loan = await queryOne<Loan>(
      'SELECT * FROM loans WHERE id = $1 AND lender_id = $2 AND deleted_at IS NULL',
      [id, userId]
    );

    if (!loan) {
      throw AppError.notFound('Loan not found');
    }

    const payments = await query<LoanPayment>(
      'SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY date DESC',
      [id]
    );

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const remaining = loan.amount - totalPaid;

    return { ...loan, payments, total_paid: totalPaid, remaining };
  }

  async create(userId: number, data: CreateLoanDTO): Promise<Loan> {
    const result = await execute(
      'INSERT INTO loans (lender_id, borrower_name, amount, description, date) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, data.borrower_name, data.amount, data.description || null, data.date]
    );

    return queryOne<Loan>(
      'SELECT * FROM loans WHERE id = $1',
      [result.rows[0].id]
    ) as Promise<Loan>;
  }

  async update(id: number, userId: number, data: Partial<CreateLoanDTO>): Promise<Loan> {
    await this.findById(id, userId);

    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.borrower_name !== undefined) {
      fields.push(`borrower_name = $${paramIndex++}`);
      values.push(data.borrower_name);
    }
    if (data.amount !== undefined) {
      fields.push(`amount = $${paramIndex++}`);
      values.push(data.amount);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.date !== undefined) {
      fields.push(`date = $${paramIndex++}`);
      values.push(data.date);
    }

    if (fields.length === 0) {
      return queryOne<Loan>(
        'SELECT * FROM loans WHERE id = $1',
        [id]
      ) as Promise<Loan>;
    }

    values.push(id);
    await execute(
      `UPDATE loans SET ${fields.join(', ')} WHERE id = $${paramIndex} AND deleted_at IS NULL`,
      values
    );

    return queryOne<Loan>(
      'SELECT * FROM loans WHERE id = $1',
      [id]
    ) as Promise<Loan>;
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await execute('UPDATE loans SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  async addPayment(loanId: number, userId: number, data: CreatePaymentDTO): Promise<LoanPayment> {
    return transaction(async (client: PoolClient) => {
      const loan = await queryOne<Loan>(
        'SELECT * FROM loans WHERE id = $1 AND lender_id = $2 AND deleted_at IS NULL',
        [loanId, userId],
        client
      );

      if (!loan) {
        throw AppError.notFound('Loan not found');
      }

      if (loan.status !== 'active') {
        throw AppError.badRequest('Loan is not active');
      }

      const paymentsResult = await execute(
        'SELECT COALESCE(SUM(amount), 0) as total_paid FROM loan_payments WHERE loan_id = $1',
        [loanId],
        client
      );
      const totalPaid = Number(paymentsResult.rows[0].total_paid);

      if (totalPaid + data.amount > loan.amount) {
        throw AppError.badRequest('Payment exceeds loan amount');
      }

      const result = await execute(
        'INSERT INTO loan_payments (loan_id, amount, description, date) VALUES ($1, $2, $3, $4) RETURNING id',
        [loanId, data.amount, data.description || null, data.date],
        client
      );

      const newTotalPaid = totalPaid + data.amount;
      if (newTotalPaid >= loan.amount) {
        await execute(
          'UPDATE loans SET status = $1 WHERE id = $2',
          ['paid', loanId],
          client
        );
      }

      return queryOne<LoanPayment>(
        'SELECT * FROM loan_payments WHERE id = $1',
        [result.rows[0].id],
        client
      ) as Promise<LoanPayment>;
    });
  }

  async deletePayment(id: number, loanId: number, userId: number): Promise<void> {
    return transaction(async (client: PoolClient) => {
      const loan = await queryOne<Loan>(
        'SELECT * FROM loans WHERE id = $1 AND lender_id = $2 AND deleted_at IS NULL',
        [loanId, userId],
        client
      );

      if (!loan) {
        throw AppError.notFound('Loan not found');
      }

      const payment = await queryOne<LoanPayment>(
        'SELECT * FROM loan_payments WHERE id = $1 AND loan_id = $2',
        [id, loanId],
        client
      );

      if (!payment) {
        throw AppError.notFound('Payment not found');
      }

      await execute('DELETE FROM loan_payments WHERE id = $1', [id], client);

      if (loan.status === 'paid') {
        await execute(
          'UPDATE loans SET status = $1 WHERE id = $2',
          ['active', loanId],
          client
        );
      }
    });
  }

  async getSummary(userId: number): Promise<any> {
    const loans = await query<Loan>(
      'SELECT * FROM loans WHERE lender_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    let totalLent = 0;
    let totalPaid = 0;
    let totalRemaining = 0;

    for (const loan of loans) {
      const payments = await queryOne<{ total: number }>(
        'SELECT COALESCE(SUM(amount), 0) as total FROM loan_payments WHERE loan_id = $1',
        [loan.id]
      );
      const paid = Number(payments?.total || 0);
      totalLent += Number(loan.amount);
      totalPaid += paid;
      totalRemaining += Number(loan.amount) - paid;
    }

    return {
      total_loans: loans.length,
      total_lent: totalLent,
      total_paid: totalPaid,
      total_remaining: totalRemaining,
    };
  }
}

export const loansService = new LoansService();
