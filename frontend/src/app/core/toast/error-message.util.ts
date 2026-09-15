import { HttpErrorResponse } from '@angular/common/http';

const BACKEND_MESSAGES: Record<string, string> = {
  'Insufficient balance': 'Saldo insuficiente en la cuenta de origen',
  'Insufficient balance (including 4x1000 tax)':
    'Saldo insuficiente (considera el impuesto 4x1000)',
  'Payment exceeds current card debt': 'El pago supera la deuda actual de la tarjeta',
  'Account is not a credit card': 'La cuenta seleccionada no es una tarjeta de crédito',
  'Cannot transfer to the same account': 'No se puede transferir a la misma cuenta',
  'Amount must be greater than zero': 'El monto debe ser mayor que cero',
  'Amount must be a positive number': 'El monto debe ser un número positivo',
  'Insufficient permissions': 'No tienes permisos para realizar esta acción',
  'No token provided': 'Tu sesión no está iniciada',
  'Invalid or expired token': 'Tu sesión expiró o el token es inválido',
  'Invalid credentials': 'Credenciales inválidas. Verifica correo y contraseña',
  'Account is disabled': 'Tu cuenta está deshabilitada',
  'Email already registered': 'El correo ya está registrado',
  'User not found': 'Usuario no encontrado',
  'Account not found': 'Cuenta no encontrada',
  'Expense not found': 'Gasto no encontrado',
  'Internal server error': 'Ocurrió un error inesperado. Inténtalo de nuevo',
};

const STATUS_MESSAGES: Record<number, string> = {
  0: 'No se pudo conectar con el servidor. Verifica tu conexión',
  400: 'Los datos enviados no son válidos',
  401: 'Debes iniciar sesión para realizar esta acción',
  403: 'No tienes permisos para realizar esta acción',
  404: 'No se encontró el recurso solicitado',
  409: 'Ya existe un registro con esos datos',
  422: 'Los datos enviados no son válidos',
  429: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo',
  500: 'Ocurrió un error en el servidor. Inténtalo de nuevo',
  502: 'El servidor no está disponible. Inténtalo más tarde',
  503: 'El servicio no está disponible. Inténtalo más tarde',
};

interface ApiErrorBody {
  error?: {
    message?: string;
    statusCode?: number;
  };
}

export function getErrorMessage(
  error: HttpErrorResponse
): { title: string; message: string } {
  if (error.status === 0) {
    return { title: 'Error de conexión', message: STATUS_MESSAGES[0] };
  }

  const rawMessage = (error.error as ApiErrorBody | undefined)?.error?.message;

  const mapped = rawMessage ? BACKEND_MESSAGES[rawMessage] : undefined;
  if (mapped) {
    return { title: 'Lo sentimos', message: mapped };
  }

  if (rawMessage?.startsWith('Validation error:')) {
    return {
      title: 'Datos inválidos',
      message: 'Algunos campos no son válidos. Revisa el formulario e inténtalo de nuevo',
    };
  }

  if (rawMessage) {
    return { title: 'Lo sentimos', message: rawMessage };
  }

  return {
    title: 'Error',
    message: STATUS_MESSAGES[error.status] || STATUS_MESSAGES[500],
  };
}