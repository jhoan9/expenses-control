import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { query, queryOne, execute } from '../../config/database';
import { usersService } from '../users/users.service';
import { AppError } from '../../shared/errors/AppError';

interface TokenPayload {
  userId: number;
  role: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(data: {
    email: string;
    password: string;
    name: string;
  }): Promise<TokenPair & { user: any }> {
    const user = await usersService.create(data);
    const tokens = this.generateTokens({ userId: user.id, role: user.role });

    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user,
    };
  }

  async login(
    email: string,
    password: string
  ): Promise<TokenPair & { user: any }> {
    const user = await usersService.validatePassword(email, password);

    const tokens = this.generateTokens({ userId: user.id, role: user.role });

    await this.saveRefreshToken(user.id, tokens.refreshToken);

    const { password_hash, ...userWithoutPassword } = user;

    return {
      ...tokens,
      user: userWithoutPassword,
    };
  }

  async refreshToken(token: string): Promise<TokenPair> {
    const storedToken = await queryOne<{ user_id: number }>(
      'SELECT user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );

    if (!storedToken) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    await execute('DELETE FROM refresh_tokens WHERE token = $1', [token]);

    const user = await usersService.findById(storedToken.user_id);
    const tokens = this.generateTokens({ userId: user.id, role: user.role });

    await this.saveRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(token: string): Promise<void> {
    await execute('DELETE FROM refresh_tokens WHERE token = $1', [token]);
  }

  async logoutAll(userId: number): Promise<void> {
    await execute('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
  }

  private generateTokens(payload: TokenPayload): TokenPair {
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    });

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(
    userId: number,
    token: string
  ): Promise<void> {
    const decoded = jwt.decode(token) as { exp?: number };
    const expiresAt = decoded.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await execute(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, token, expiresAt]
    );
  }
}

export const authService = new AuthService();
