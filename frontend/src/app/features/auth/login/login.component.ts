import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <h1>Iniciar Sesión</h1>
        <p class="subtitle">Expenses Control</p>

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="form-group">
            <label for="email">Email</label>
            <input
              type="email"
              id="email"
              formControlName="email"
              placeholder="tu@email.com"
            />
            <span class="error" *ngIf="loginForm.get('email')?.touched && loginForm.get('email')?.errors?.['required']">
              El email es requerido
            </span>
            <span class="error" *ngIf="loginForm.get('email')?.touched && loginForm.get('email')?.errors?.['email']">
              Email inválido
            </span>
          </div>

          <div class="form-group">
            <label for="password">Contraseña</label>
            <input
              type="password"
              id="password"
              formControlName="password"
              placeholder="••••••••"
            />
            <span class="error" *ngIf="loginForm.get('password')?.touched && loginForm.get('password')?.errors?.['required']">
              La contraseña es requerida
            </span>
          </div>

          <div class="error-message" *ngIf="errorMessage">
            {{ errorMessage }}
          </div>

          <button type="submit" [disabled]="loginForm.invalid || isLoading">
            {{ isLoading ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </form>

        <p class="auth-link">
          ¿No tienes cuenta? <a routerLink="/auth/register">Regístrate</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    }
    .auth-card {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 400px;
    }
    h1 {
      margin: 0 0 8px 0;
      color: #333;
    }
    .subtitle {
      color: #888;
      margin: 0 0 24px 0;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
      color: #333;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
      box-sizing: border-box;
    }
    input:focus {
      outline: none;
      border-color: #4caf50;
    }
    .error {
      color: #e53935;
      font-size: 0.85rem;
      margin-top: 4px;
      display: block;
    }
    .error-message {
      background: #ffebee;
      color: #c62828;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    button {
      width: 100%;
      padding: 12px;
      background: #4caf50;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      margin-top: 8px;
    }
    button:hover:not(:disabled) {
      background: #43a047;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .auth-link {
      text-align: center;
      margin-top: 16px;
      color: #666;
    }
    .auth-link a {
      color: #4caf50;
      text-decoration: none;
    }
  `]
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.error?.message || 'Error al iniciar sesión';
      },
    });
  }
}
