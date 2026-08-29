import bcrypt from 'bcrypt';
import { query, queryOne, execute } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';

type UserRole = 'jh01' | 'ji01' | 'user' | 'admin';

interface User {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateUserDTO {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

interface UpdateUserDTO {
  name?: string;
  email?: string;
  role?: UserRole;
}

const SALT_ROUNDS = 10;

export class UsersService {
  async findAll(page: number = 1, limit: number = 20): Promise<{ users: Omit<User, 'password_hash'>[]; total: number }> {
    const offset = (page - 1) * limit;

    const countResult = await queryOne<{ total: number }>(
      'SELECT COUNT(*) as total FROM users WHERE deleted_at IS NULL'
    );
    const total = countResult?.total || 0;

    const users = await query<Omit<User, 'password_hash'>>(
      'SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    return { users, total };
  }

  async findById(id: number): Promise<Omit<User, 'password_hash'>> {
    const user = await queryOne<User>(
      'SELECT id, email, name, role, is_active, created_at, updated_at FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );

    if (!user) {
      throw AppError.notFound('User not found');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return queryOne<User>(
      'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );
  }

  async create(data: CreateUserDTO): Promise<Omit<User, 'password_hash'>> {
    const existingUser = await this.findByEmail(data.email);
    if (existingUser) {
      throw AppError.conflict('Email already registered');
    }

    const password_hash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const result = await execute(
      'INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [data.email, password_hash, data.name, data.role || 'user']
    );

    return this.findById(result.rows[0].id);
  }

  async update(id: number, data: UpdateUserDTO): Promise<Omit<User, 'password_hash'>> {
    const user = await this.findById(id);

    if (data.email && data.email !== user.email) {
      const existingUser = await this.findByEmail(data.email);
      if (existingUser) {
        throw AppError.conflict('Email already registered');
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push(`name = $${fields.length + 1}`);
      values.push(data.name);
    }
    if (data.email !== undefined) {
      fields.push(`email = $${fields.length + 1}`);
      values.push(data.email);
    }
    if (data.role !== undefined) {
      fields.push(`role = $${fields.length + 1}`);
      values.push(data.role);
    }

    if (fields.length === 0) {
      return user;
    }

    values.push(id);
    await execute(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${fields.length + 1} AND deleted_at IS NULL`,
      values
    );

    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.findById(id);
    await execute('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
  }

  async validatePassword(email: string, password: string): Promise<User> {
    const user = await queryOne<User>(
      'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (!user) {
      throw AppError.unauthorized('Invalid credentials');
    }

    if (!user.is_active) {
      throw AppError.unauthorized('Account is disabled');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw AppError.unauthorized('Invalid credentials');
    }

    // Downgrade legacy hashes (cost > 10) on successful login so
    // future logins verify much faster with native bcrypt.
    if (bcrypt.getRounds(user.password_hash) > SALT_ROUNDS) {
      const rehashed = await bcrypt.hash(password, SALT_ROUNDS);
      await execute('UPDATE users SET password_hash = $1 WHERE id = $2', [
        rehashed,
        user.id,
      ]);
    }

    return user;
  }
}

export const usersService = new UsersService();
