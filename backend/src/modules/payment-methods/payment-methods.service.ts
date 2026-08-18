import { query, queryOne, execute } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';

interface PaymentMethod {
  id: number;
  name: string;
  type: 'cash' | 'debit' | 'credit' | 'transfer' | 'pse' | 'other';
  is_active: boolean;
  created_at: Date;
}

interface CreatePaymentMethodDTO {
  name: string;
  type: 'cash' | 'debit' | 'credit' | 'transfer' | 'pse' | 'other';
}

interface UpdatePaymentMethodDTO {
  name?: string;
  type?: 'cash' | 'debit' | 'credit' | 'transfer' | 'pse' | 'other';
  is_active?: boolean;
}

export class PaymentMethodsService {
  async findAll(): Promise<PaymentMethod[]> {
    return query<PaymentMethod>(
      'SELECT * FROM payment_methods WHERE is_active = TRUE ORDER BY name'
    );
  }

  async findById(id: number): Promise<PaymentMethod> {
    const paymentMethod = await queryOne<PaymentMethod>(
      'SELECT * FROM payment_methods WHERE id = $1',
      [id]
    );

    if (!paymentMethod) {
      throw AppError.notFound('Payment method not found');
    }

    return paymentMethod;
  }

  async create(data: CreatePaymentMethodDTO): Promise<PaymentMethod> {
    const result = await execute(
      'INSERT INTO payment_methods (name, type) VALUES ($1, $2) RETURNING id',
      [data.name, data.type]
    );

    return this.findById(result.rows[0].id);
  }

  async update(id: number, data: UpdatePaymentMethodDTO): Promise<PaymentMethod> {
    await this.findById(id);

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

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    await execute(
      `UPDATE payment_methods SET ${fields.join(', ')} WHERE id = $${fields.length + 1}`,
      values
    );

    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.findById(id);
    await execute('UPDATE payment_methods SET is_active = FALSE WHERE id = $1', [id]);
  }
}

export const paymentMethodsService = new PaymentMethodsService();
