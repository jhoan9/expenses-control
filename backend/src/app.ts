import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './shared/middleware/error.middleware';
import { AppError } from './shared/errors/AppError';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import accountsRoutes from './modules/accounts/accounts.routes';
import categoriesRoutes from './modules/categories/categories.routes';
import paymentMethodsRoutes from './modules/payment-methods/payment-methods.routes';
import incomeRoutes from './modules/income/income.routes';
import expensesRoutes from './modules/expenses/expenses.routes';
import budgetRoutes from './modules/budget/budget.routes';
import investmentsRoutes from './modules/investments/investments.routes';
import thirdPartyRoutes from './modules/third-party/third-party.routes';
import loansRoutes from './modules/loans/loans.routes';
import creditsRoutes from './modules/credits/credits.routes';
import reportsRoutes from './modules/reports/reports.routes';

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/payment-methods', paymentMethodsRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/investments', investmentsRoutes);
app.use('/api/third-party', thirdPartyRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/reports', reportsRoutes);

app.use('/api', (req, res, next) => {
  next(AppError.notFound('Endpoint not found'));
});

app.use(errorHandler);

export default app;
