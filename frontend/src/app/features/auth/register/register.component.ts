import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { IconComponent } from '../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, IconComponent],
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
          <h1>Tu dinero merece <br />una segunda mirada.</h1>
          <p>
            Crea tu cuenta y empieza a tomar decisiones financieras con
            confianza, claridad y control total.
          </p>
        </div>

        <div class="auth-brand-features">
          <span><app-icon name="shield-check" /> Datos seguros</span>
          <span><app-icon name="target" /> Objetivos claros</span>
          <span><app-icon name="bar-chart" /> Reportes simples</span>
        </div>
      </div>

      <div class="auth-form-side">
        <div class="auth-card">
          <div class="auth-card-header">
            <div class="auth-mobile-brand">
              <img src="assets/icono.png" alt="Controla" />
              <strong>Controla</strong>
            </div>
            <h2>Crear cuenta</h2>
            <p>Empieza a tomar control de tus finanzas hoy.</p>
          </div>

          <form class="auth-form" [formGroup]="registerForm" (ngSubmit)="onSubmit()">
            <div class="form-group">
              <label for="name">Nombre</label>
              <input
                type="text"
                id="name"
                formControlName="name"
                placeholder="Tu nombre"
                autocomplete="name"
              />
              <span class="error" *ngIf="registerForm.get('name')?.touched && registerForm.get('name')?.errors?.['required']">
                El nombre es requerido
              </span>
            </div>

            <div class="form-group">
              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                formControlName="email"
                placeholder="tu@email.com"
                autocomplete="email"
              />
              <span class="error" *ngIf="registerForm.get('email')?.touched && registerForm.get('email')?.errors?.['required']">
                El email es requerido
              </span>
              <span class="error" *ngIf="registerForm.get('email')?.touched && registerForm.get('email')?.errors?.['email']">
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
                autocomplete="new-password"
              />
              <span class="error" *ngIf="registerForm.get('password')?.touched && registerForm.get('password')?.errors?.['required']">
                La contraseña es requerida
              </span>
              <span class="error" *ngIf="registerForm.get('password')?.touched && registerForm.get('password')?.errors?.['minlength']">
                Mínimo 8 caracteres
              </span>
            </div>

            <div class="form-group">
              <label for="confirmPassword">Confirmar contraseña</label>
              <input
                type="password"
                id="confirmPassword"
                formControlName="confirmPassword"
                placeholder="••••••••"
                autocomplete="new-password"
              />
              <span class="error" *ngIf="registerForm.get('confirmPassword')?.touched && registerForm.errors?.['passwordMismatch']">
                Las contraseñas no coinciden
              </span>
            </div>

            <div class="error-message" *ngIf="errorMessage">
              <app-icon name="alert-circle" />
              {{ errorMessage }}
            </div>

            <button type="submit" class="btn-primary" [disabled]="registerForm.invalid || isLoading">
              <span *ngIf="isLoading" class="button-spinner"></span>
              {{ isLoading ? 'Creando cuenta...' : 'Crear cuenta' }}
            </button>
          </form>

          <p class="auth-footer">
            ¿Ya tienes cuenta? <a routerLink="/auth/login">Inicia sesión</a>
          </p>
        </div>
      </div>
    </div>
  `,
})
export class RegisterComponent {
  registerForm: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group(
      {
        name: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';

    const { name, email, password } = this.registerForm.value;

    this.authService.register({ name, email, password }).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.error?.message || 'Error al crear cuenta';
      },
    });
  }
}