import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';
import { AuthRequest } from './auth.middleware';
import { apiTokensService, TOKEN_PREFIX } from '../../modules/integrations/api-tokens.service';

/**
 * Acepta la sesión normal de la web (JWT) o un token personal ("ctl_...").
 * Pensado para endpoints que usan las automatizaciones del celular.
 */
export const authenticateUserOrToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw AppError.unauthorized('Falta el token. Usa el encabezado Authorization: Bearer <token>');

    if (token.startsWith(TOKEN_PREFIX)) {
      const owner = await apiTokensService.verify(token);
      if (!owner) throw AppError.unauthorized('Token inválido o revocado');
      req.userId = owner.userId;
      req.userRole = owner.role;
      req.authVia = 'token';
      return next();
    }

    let decoded: { userId: number; role: string };
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as { userId: number; role: string };
    } catch {
      throw AppError.unauthorized('Invalid or expired token');
    }
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.authVia = 'session';
    next();
  } catch (err) {
    next(err);
  }
};
