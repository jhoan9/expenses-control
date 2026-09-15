import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../toast/toast.service';
import { getErrorMessage } from '../toast/error-message.util';
import { AuthService } from '../auth/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 se maneja en authInterceptor (refresh). Solo se notifica aquí
      // cuando no hay refresh token disponible (p. ej. error de login).
      if (error.status === 401 && authService.refreshToken) {
        return throwError(() => error);
      }

      const { title, message } = getErrorMessage(error);
      toastService.showError(message, title);
      return throwError(() => error);
    })
  );
};