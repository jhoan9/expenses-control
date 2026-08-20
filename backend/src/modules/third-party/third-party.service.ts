import { PoolClient } from 'pg';
import { query, queryOne, execute, transaction } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';

interface ThirdPartyAccount {
  id: number;
  person_name: string;
  total_contributed: number;
  total_invested: number;
  total_available: number;
  total_gains: number;
  created_at: Date;
  updated_at: Date;
}

interface ThirdPartyMovement {
  id: number;
  third_party_account_id: number;
  user_id: number;
  type: 'deposit' | 'withdrawal' | 'investment_buy' | 'investment_sell' | 'transfer';
  amount: number;
  description: string | null;
  date: string;
  related_position_id: number | null;
  created_at: Date;
}

interface ThirdPartyAccountWithMovements extends ThirdPartyAccount {
  movements?: ThirdPartyMovement[];
}

interface CreateThirdPartyDTO {
  person_name: string;
}

interface CreateMovementDTO {
  type: 'deposit' | 'withdrawal' | 'investment_buy' | 'investment_sell' | 'transfer';
  amount: number;
  description?: string;
  date: string;
  related_position_id?: number;
}

export class ThirdPartyService {
  async findAll(userId: number): Promise<ThirdPartyAccount[]> {
    return query<ThirdPartyAccount>(
      'SELECT * FROM third_party_accounts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY person_name',
      [userId]
    );
  }

  async findById(id: number, userId: number): Promise<ThirdPartyAccountWithMovements> {
    const account = await queryOne<ThirdPartyAccount>(
      'SELECT * FROM third_party_accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId]
    );

    if (!account) {
      throw AppError.notFound('Third party account not found');
    }

    const movements = await query<ThirdPartyMovement>(
      'SELECT * FROM third_party_movements WHERE third_party_account_id = $1 ORDER BY date DESC, created_at DESC',
      [id]
    );

    return { ...account, movements };
  }

  async create(userId: number, data: CreateThirdPartyDTO): Promise<ThirdPartyAccount> {
    const result = await execute(
      'INSERT INTO third_party_accounts (user_id, person_name) VALUES ($1, $2) RETURNING id',
      [userId, data.person_name]
    );

    return queryOne<ThirdPartyAccount>(
      'SELECT * FROM third_party_accounts WHERE id = $1',
      [result.rows[0].id]
    ) as Promise<ThirdPartyAccount>;
  }

  async update(id: number, userId: number, data: Partial<CreateThirdPartyDTO>): Promise<ThirdPartyAccount> {
    await this.findById(id, userId);

    if (data.person_name !== undefined) {
      await execute(
        'UPDATE third_party_accounts SET person_name = $1 WHERE id = $2 AND deleted_at IS NULL',
        [data.person_name, id]
      );
    }

    return queryOne<ThirdPartyAccount>(
      'SELECT * FROM third_party_accounts WHERE id = $1',
      [id]
    ) as Promise<ThirdPartyAccount>;
  }

  async delete(id: number, userId: number): Promise<void> {
    await this.findById(id, userId);
    await execute(
      'UPDATE third_party_accounts SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  async addMovement(thirdPartyId: number, userId: number, data: CreateMovementDTO): Promise<ThirdPartyMovement> {
    return transaction(async (client: PoolClient) => {
      const account = await queryOne<ThirdPartyAccount>(
        'SELECT * FROM third_party_accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [thirdPartyId, userId],
        client
      );

      if (!account) {
        throw AppError.notFound('Third party account not found');
      }

      let newContributed = Number(account.total_contributed);
      let newInvested = Number(account.total_invested);
      let newAvailable = Number(account.total_available);
      let newGains = Number(account.total_gains);

      switch (data.type) {
        case 'deposit':
          newContributed += data.amount;
          newAvailable += data.amount;
          break;
        case 'withdrawal':
          if (newAvailable < data.amount) {
            throw AppError.badRequest('Insufficient available balance');
          }
          newAvailable -= data.amount;
          break;
        case 'investment_buy':
          if (newAvailable < data.amount) {
            throw AppError.badRequest('Insufficient available balance');
          }
          newAvailable -= data.amount;
          newInvested += data.amount;
          break;
        case 'investment_sell':
          newAvailable += data.amount;
          newInvested -= data.amount;
          break;
        case 'transfer':
          newAvailable += data.amount;
          break;
      }

      const result = await execute(
        'INSERT INTO third_party_movements (third_party_account_id, user_id, type, amount, description, date, related_position_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
        [thirdPartyId, userId, data.type, data.amount, data.description || null, data.date, data.related_position_id || null],
        client
      );

      await execute(
        'UPDATE third_party_accounts SET total_contributed = $1, total_invested = $2, total_available = $3, total_gains = $4 WHERE id = $5',
        [newContributed, newInvested, newAvailable, newGains, thirdPartyId],
        client
      );

      return queryOne<ThirdPartyMovement>(
        'SELECT * FROM third_party_movements WHERE id = $1',
        [result.rows[0].id],
        client
      ) as Promise<ThirdPartyMovement>;
    });
  }

  async getSummary(id: number, userId: number): Promise<any> {
    const account = await this.findById(id, userId);

    const movementsByType = await query<{ type: string; total: number }>(
      'SELECT type, COALESCE(SUM(amount), 0) as total FROM third_party_movements WHERE third_party_account_id = $1 GROUP BY type',
      [id]
    );

    return {
      account,
      movementsByType,
    };
  }
}

export const thirdPartyService = new ThirdPartyService();
