import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';

interface PgError extends Error {
  code?: string;
}

const POSTGRES_ERROR_MAP: Record<string, { statusCode: number; message: string }> = {
  '23505': { statusCode: 409, message: 'Ya existe un registro con esos datos' },
  '23503': {
    statusCode: 400,
    message: 'El registro está relacionado con otros datos o no existe',
  },
  '23514': { statusCode: 400, message: 'Uno de los valores enviados no es válido' },
  '23502': { statusCode: 400, message: 'Falta un valor obligatorio' },
  '22P02': { statusCode: 400, message: 'Uno de los valores enviados tiene un formato inválido' },
  '22001': { statusCode: 400, message: 'Uno de los valores excede la longitud máxima permitida' },
  '42P01': { statusCode: 500, message: 'Error interno: recurso no disponible' },
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        statusCode: err.statusCode,
      },
    });
    return;
  }

  const pgErr = err as PgError;
  const mapped = pgErr.code ? POSTGRES_ERROR_MAP[pgErr.code] : undefined;
  if (mapped) {
    console.error(`[Postgres ${pgErr.code}]`, pgErr.message);
    res.status(mapped.statusCode).json({
      success: false,
      error: {
        message: mapped.message,
        statusCode: mapped.statusCode,
      },
    });
    return;
  }

  console.error('Unexpected error:', err);

  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      statusCode: 500,
    },
  });
};