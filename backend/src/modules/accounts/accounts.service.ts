import { query, queryOne, execute, transaction } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { PoolClient } from 'pg';

type AccountType = 'savings' | 'checking' | 'cash' | 'investment' | 'credit_card' | 'bajo_monto' | 'other';

interface Account {
  id: number;
  user_id: number;
  name: string;
  type: AccountType;
  currency: string;
  balance: number;
  credit_limit: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateAccountDTO {
  name: string;
  type: AccountType;
  currency?: string;
  balance?: number;
  credit_limit?: number;
}

interface UpdateAccountDTO {
  name?: string;
  type?: AccountType;
  balance?: number;
  credit_limit?: number;
  is_active?: boolean;
}

interface TransferDTO {
  to_account_id: number;
  amount: number;
  applies_four_x_thousand?: boolean;
  description?: string;
}

interface CreditCardPaymentDTO {
  from_account_id: number;
  amount: number;
  description?: string;
}

const FOUR_X_THOUSAND_RATE = 0.004;

export class AccountsService {
  async findAllByUser(userId: number): Promise<Account[]> {
    return query<Account>(
      'SELECT * FROM accounts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name',
      [userId]
    );
  }

  async findById(id: number, userId: number): Promise<Account> {
    const account = await queryOne<Account>(
      'SELECT * FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId]
    );

    if (!account) {
      throw AppError.notFound('Account not found');
    }

    return account;
  }

  async create(userId: number, data: CreateAccountDTO): Promise<Account> {
    const result = await execute(
      'INSERT INTO accounts (user_id, name, type, currency, balance, credit_limit) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [userId, data.name, data.type, data.currency || 'COP', data.balance || 0, data.credit_limit || 0]
    );

    return this.findById(result.rows[0].id, userId);
  }

  async update(id: number, userId: number, data: UpdateAccountDTO): Promise<Account> {
    await this.findById(id, userId);

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push(`name = $${fields.length + 1}`);
      values.push(data.name);
    }
    if (data.type !== undefined) {
      fields.push(`type = $${fields.length + 1}`);
      values.push(data.type);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${fields.length + 1}`);
      values.push(data.is_active);
    }
    if (data.balance !== undefined) {
      fields.push(`balance = $${fields.length + 1}`);
      values.push(data.balance);
    }
    if (data.credit_limit !== undefined) {
      fields.push(`credit_limit = $${fields.length + 1}`);
      values.push(data.credit_limit);
    }

    if (fields.length === 0) {
      return this.findById(id, userId);
    }

    values.push(id, userId);
    await execute(
      `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${fields.length + 1} AND user_id = $${fields.length + 2} AND deleted_at IS NULL`,
      values
    );

    return this.findById(id, userId);
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await execute(
      'UPDATE accounts SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  }

  async updateBalance(id: number, amount: number, userId: number): Promise<Account> {
    const account = await this.findById(id, userId);

    const newBalance = Number(account.balance) + amount;
    if (newBalance < 0) {
      throw AppError.badRequest('Insufficient balance');
    }

    await execute(
      'UPDATE accounts SET balance = $1 WHERE id = $2 AND user_id = $3',
      [newBalance, id, userId]
    );

    return this.findById(id, userId);
  }

  async transfer(fromId: number, toId: number, userId: number, data: TransferDTO): Promise<Account> {
    if (fromId === toId) {
      throw AppError.badRequest('Cannot transfer to the same account');
    }

    const from = await this.findById(fromId, userId);
    const to = await this.findById(toId, userId);

    const amount = Number(data.amount);
    const tax = data.applies_four_x_thousand ? Math.round(amount * FOUR_X_THOUSAND_RATE * 100000) / 100000 : 0;
    const totalDebit = amount + tax;

    if (Number(from.balance) < totalDebit) {
      throw AppError.badRequest('Insufficient balance (including 4x1000 tax)');
    }

    return transaction(async (client: PoolClient) => {
      const newFromBalance = Number(from.balance) - totalDebit;
      const newToBalance = Number(to.balance) + amount;

      await execute(
        'UPDATE accounts SET balance = $1 WHERE id = $2 AND user_id = $3',
        [newFromBalance, fromId, userId],
        client
      );
      await execute(
        'UPDATE accounts SET balance = $1 WHERE id = $2 AND user_id = $3',
        [newToBalance, toId, userId],
        client
      );

      const description = data.description || `Transfer to ${to.name}`;
      await execute(
        'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)',
        [fromId, 'transfer', totalDebit, from.balance, newFromBalance, 'transfer', toId, description],
        client
      );
      await execute(
        'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)',
        [toId, 'transfer', amount, to.balance, newToBalance, 'transfer', fromId, `Transfer from ${from.name}`],
        client
      );

      return this.findById(fromId, userId);
    });
  }

  async creditCardPayment(cardId: number, userId: number, data: CreditCardPaymentDTO): Promise<Account> {
    const card = await this.findById(cardId, userId);

    if (card.type !== 'credit_card') {
      throw AppError.badRequest('Account is not a credit card');
    }

    const from = await this.findById(data.from_account_id, userId);
    const amount = Number(data.amount);

    if (amount <= 0) {
      throw AppError.badRequest('Amount must be greater than zero');
    }
    if (Number(from.balance) < amount) {
      throw AppError.badRequest('Insufficient balance');
    }
    if (Number(card.balance) < amount) {
      throw AppError.badRequest('Payment exceeds current card debt');
    }

    return transaction(async (client: PoolClient) => {
      const newFromBalance = Number(from.balance) - amount;
      const newCardBalance = Number(card.balance) - amount;

      await execute(
        'UPDATE accounts SET balance = $1 WHERE id = $2 AND user_id = $3',
        [newFromBalance, data.from_account_id, userId],
        client
      );
      await execute(
        'UPDATE accounts SET balance = $1 WHERE id = $2 AND user_id = $3',
        [newCardBalance, cardId, userId],
        client
      );

      await execute(
        'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)',
        [data.from_account_id, 'expense', amount, from.balance, newFromBalance, 'credit_card_payment', cardId, data.description || `Abono a ${card.name}`],
        client
      );
      await execute(
        'INSERT INTO account_movements (account_id, type, amount, balance_before, balance_after, reference_type, reference_id, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)',
        [cardId, 'credit_payment', amount, card.balance, newCardBalance, 'credit_card_payment', data.from_account_id, `Abono desde ${from.name}`],
        client
      );

      return this.findById(cardId, userId);
    });
  }

  async getMovements(id: number, userId: number): Promise<any[]> {
    await this.findById(id, userId);
    return query<any>(
      `SELECT
         m.id, m.type, m.amount, m.balance_before, m.balance_after,
         m.reference_type, m.reference_id, m.description, m.created_at,
         COALESCE(
           i.date,
           e.date,
           p.opened_at::date,
           m.date
         ) AS date
       FROM account_movements m
       LEFT JOIN income i ON m.reference_type = 'income' AND i.id = m.reference_id
       LEFT JOIN expenses e ON m.reference_type = 'expense' AND e.id = m.reference_id
       LEFT JOIN positions p ON m.reference_type = 'position' AND p.id = m.reference_id
       WHERE m.account_id = $1
       ORDER BY date DESC, m.created_at DESC`,
      [id]
    );
  }
}

export const accountsService = new AccountsService();
