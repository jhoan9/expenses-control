import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { NoAuthGuard } from './core/guards/no-auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [NoAuthGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.component').then(
            (m) => m.LoginComponent
          ),
      },
      {
        path: 'register',
        loadComponent: () =>
          import('./features/auth/register/register.component').then(
            (m) => m.RegisterComponent
          ),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  {
    path: '',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./shared/components/layout/layout.component').then(
        (m) => m.LayoutComponent
      ),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'accounts',
        loadComponent: () =>
          import('./features/accounts/accounts.component').then(
            (m) => m.AccountsComponent
          ),
      },
      {
        path: 'income',
        loadComponent: () =>
          import('./features/income/income.component').then(
            (m) => m.IncomeComponent
          ),
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./features/expenses/expenses.component').then(
            (m) => m.ExpensesComponent
          ),
      },
      {
        path: 'budget',
        loadComponent: () =>
          import('./features/budget/budget.component').then(
            (m) => m.BudgetComponent
          ),
      },
      {
        path: 'investments',
        loadComponent: () =>
          import('./features/investments/investments.component').then(
            (m) => m.InvestmentsComponent
          ),
      },
      {
        path: 'third-party',
        loadComponent: () =>
          import('./features/third-party/third-party.component').then(
            (m) => m.ThirdPartyComponent
          ),
      },
      {
        path: 'loans',
        loadComponent: () =>
          import('./features/loans/loans.component').then(
            (m) => m.LoansComponent
          ),
      },
      {
        path: 'credits',
        loadComponent: () =>
          import('./features/credits/credits.component').then(
            (m) => m.CreditsComponent
          ),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./features/categories/categories.component').then(
            (m) => m.CategoriesComponent
          ),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./features/reports/reports.component').then(
            (m) => m.ReportsComponent
          ),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
