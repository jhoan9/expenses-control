import { query, queryOne, execute } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';

interface Account {
  id: number;
  user_id: number;
  name: string;
  type: 'savings' | 'checking' | 'cash' | 'investment' | 'other';
  currency: string;
  balance: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateAccountDTO {
  name: string;
  type: 'savings' | 'checking' | 'cash' | 'investment' | 'other';
  currency?: string;
  balance?: number;
}

interface UpdateAccountDTO {
  name?: string;
  type?: 'savings' | 'checking' | 'cash' | 'investment' | 'other';
  balance?: number;
  is_active?: boolean;
}

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
      'INSERT INTO accounts (user_id, name, type, currency, balance) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [userId, data.name, data.type, data.currency || 'COP', data.balance || 0]
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
}

export const accountsService = new AccountsService();
