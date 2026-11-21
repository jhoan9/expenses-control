import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconComponent, ThemeToggleComponent],
  template: `
    <div class="auth-container">
      <div class="auth-brand">
        <div class="auth-brand-top">
          <img class="brand-icon" src="assets/icono.png" alt="Controla" />
          <div class="brand-text">
            <span class="brand-name">Controla</span>
            <span class="brand-sub">Finanzas Personales</span>
          </div>
        </div>

        <div class="auth-brand-mid">
          <h1>Tus cuentas, gastos y presupuesto en un solo tablero.</h1>
          <p>Registra cada movimiento en pesos, mira a dónde se va el dinero por categoría y planifica la quincena antes de que empiece.</p>
        </div>

        <div class="auth-preview" aria-hidden="true">
          <div class="auth-preview-head">
            <span>Neto mensual, últimos 12 meses</span>
            <span>COP</span>
          </div>
          <div class="auth-preview-bars">
            <span style="height: 38%; animation-delay: 0ms"></span>
            <span style="height: 52%; animation-delay: 40ms"></span>
            <span style="height: 45%; animation-delay: 80ms"></span>
            <span style="height: 64%; animation-delay: 120ms"></span>
            <span style="height: 58%; animation-delay: 160ms"></span>
            <span style="height: 76%; animation-delay: 200ms"></span>
            <span style="height: 68%; animation-delay: 240ms"></span>
            <span style="height: 86%; animation-delay: 280ms"></span>
            <span style="height: 74%; animation-delay: 320ms"></span>
            <span style="height: 96%; animation-delay: 360ms"></span>
            <span style="height: 82%; animation-delay: 400ms"></span>
            <span style="height: 100%; animation-delay: 440ms"></span>
          </div>
          <div class="auth-brand-features">
            <span><app-icon name="shield-check" /> Sesión protegida con token</span>
            <span><app-icon name="target" /> Presupuesto por quincena</span>
            <span><app-icon name="bar-chart" /> Reportes por categoría</span>
          </div>
        </div>
      </div>

      <div class="auth-form-side">
        <app-theme-toggle class="auth-theme-toggle" />
        <div class="auth-card">
          <div class="auth-card-header">
            <div class="auth-mobile-brand">
              <img src="assets/icono.png" alt="Controla" />
              <strong>Controla</strong>
            </div>
            <h2>Iniciar sesión</h2>
            <p>Bienvenido de nuevo, ingresa a tu espacio financiero.</p>
          </div>

          <form class="auth-form" [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                formControlName="email"
                placeholder="tu@email.com"
                autocomplete="email"
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
                autocomplete="current-password"
              />
              <span class="error" *ngIf="loginForm.get('password')?.touched && loginForm.get('password')?.errors?.['required']">
                La contraseña es requerida
              </span>
            </div>

            <div class="error-message" *ngIf="errorMessage">
              <app-icon name="alert-circle" />
              {{ errorMessage }}
            </div>

            <button type="submit" class="btn-primary" [disabled]="loginForm.invalid || isLoading">
              <span *ngIf="isLoading" class="button-spinner"></span>
              {{ isLoading ? 'Ingresando...' : 'Ingresar' }}
            </button>
          </form>

          <p class="auth-footer">
            ¿No tienes cuenta? <a routerLink="/auth/register">Regístrate</a>
          </p>
        </div>
      </div>
    </div>
  `,
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