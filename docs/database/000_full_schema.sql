-- =============================================
-- EXPENSES CONTROL - ESQUEMA COMPLETO
-- =============================================
-- Fecha: 2024
-- Moneda: COP (Pesos colombianos)
-- Base de datos: PostgreSQL
-- =============================================

-- =============================================
-- 001: USUARIOS
-- =============================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_refresh_tokens_token UNIQUE (token),
  CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- 002: CUENTAS Y MÉTODOS DE PAGO
-- =============================================

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('savings', 'checking', 'cash', 'investment', 'other')),
  currency VARCHAR(3) DEFAULT 'COP',
  balance DECIMAL(15,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_accounts_user FOREIGN KEY (user_id)
    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('cash', 'debit', 'credit', 'transfer', 'pse', 'other')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 003: CATEGORÍAS Y SUBCATEGORÍAS
-- =============================================

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(10) DEFAULT 'both' CHECK (type IN ('expense', 'income', 'both')),
  icon VARCHAR(50),
  color VARCHAR(7),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS subcategories (
  id SERIAL PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_subcategories_category FOREIGN KEY (category_id)
    REFERENCES categories(id) ON DELETE CASCADE
);

-- =============================================
-- 004: INGRESOS Y GASTOS
-- =============================================

CREATE TABLE IF NOT EXISTS income (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  account_id INT NOT NULL,
  category_id INT,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_income_user FOREIGN KEY (user_id)
    REFERENCES users(id),
  CONSTRAINT fk_income_account FOREIGN KEY (account_id)
    REFERENCES accounts(id),
  CONSTRAINT fk_income_category FOREIGN KEY (category_id)
    REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  account_id INT NOT NULL,
  category_id INT,
  subcategory_id INT,
  payment_method_id INT,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_expenses_user FOREIGN KEY (user_id)
    REFERENCES users(id),
  CONSTRAINT fk_expenses_account FOREIGN KEY (account_id)
    REFERENCES accounts(id),
  CONSTRAINT fk_expenses_category FOREIGN KEY (category_id)
    REFERENCES categories(id),
  CONSTRAINT fk_expenses_subcategory FOREIGN KEY (subcategory_id)
    REFERENCES subcategories(id),
  CONSTRAINT fk_expenses_payment_method FOREIGN KEY (payment_method_id)
    REFERENCES payment_methods(id)
);

-- =============================================
-- 005: PRESUPUESTO Y OBLIGACIONES
-- =============================================

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('first', 'second')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_income DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id)
    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS budget_items (
  id SERIAL PRIMARY KEY,
  budget_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  is_recurrent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_budget_items_budget FOREIGN KEY (budget_id)
    REFERENCES budgets(id) ON DELETE CASCADE
);

-- =============================================
-- 006: INVERSIONES Y POSICIONES
-- =============================================

CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  ticker VARCHAR(20),
  exchange VARCHAR(50),
  type VARCHAR(20) NOT NULL CHECK (type IN ('stock', 'bond', 'etf', 'crypto', 'other')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_investments_user FOREIGN KEY (user_id)
    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  investment_id INT NOT NULL,
  user_id INT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('buy', 'sell')),
  quantity DECIMAL(15,6) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  commission DECIMAL(15,2) DEFAULT 0.00,
  total_cost DECIMAL(15,2) NOT NULL,
  status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  notes TEXT,
  FOREIGN KEY (investment_id)
    REFERENCES investments(id),
  FOREIGN KEY (user_id)
    REFERENCES users(id)
);

-- =============================================
-- 007: TERCEROS
-- =============================================

CREATE TABLE IF NOT EXISTS third_party_accounts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  person_name VARCHAR(100) NOT NULL,
  total_contributed DECIMAL(15,2) DEFAULT 0.00,
  total_invested DECIMAL(15,2) DEFAULT 0.00,
  total_available DECIMAL(15,2) DEFAULT 0.00,
  total_gains DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_third_party_account_user FOREIGN KEY (user_id)
    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS third_party_movements (
  id SERIAL PRIMARY KEY,
  third_party_account_id INT NOT NULL,
  user_id INT NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'investment_buy', 'investment_sell', 'transfer')),
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  related_position_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_third_party_mov_account FOREIGN KEY (third_party_account_id)
    REFERENCES third_party_accounts(id),
  CONSTRAINT fk_third_party_mov_user FOREIGN KEY (user_id)
    REFERENCES users(id),
  CONSTRAINT fk_third_party_mov_position FOREIGN KEY (related_position_id)
    REFERENCES positions(id)
);

-- =============================================
-- 008: PRÉSTAMOS
-- =============================================

CREATE TABLE IF NOT EXISTS loans (
  id SERIAL PRIMARY KEY,
  lender_id INT NOT NULL,
  borrower_id INT,
  borrower_name VARCHAR(100),
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paid', 'cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_loans_lender FOREIGN KEY (lender_id)
    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id SERIAL PRIMARY KEY,
  loan_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_payments_loan FOREIGN KEY (loan_id)
    REFERENCES loans(id) ON DELETE CASCADE
);

-- =============================================
-- 009: CRÉDITOS
-- =============================================

CREATE TABLE IF NOT EXISTS credits (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  institution VARCHAR(100) NOT NULL,
  credit_limit DECIMAL(15,2) NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0.00,
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_credits_user FOREIGN KEY (user_id)
    REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS credit_payments (
  id SERIAL PRIMARY KEY,
  credit_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  minimum_payment DECIMAL(15,2),
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_credit_payments_credit FOREIGN KEY (credit_id)
    REFERENCES credits(id) ON DELETE CASCADE
);

-- =============================================
-- 010: AUDITORÍA - MOVIMIENTOS DE CUENTAS
-- =============================================

CREATE TABLE IF NOT EXISTS account_movements (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'income',
    'expense',
    'transfer',
    'investment_buy',
    'investment_sell',
    'loan_disbursement',
    'loan_payment',
    'credit_payment',
    'adjustment'
  )),
  amount DECIMAL(15,2) NOT NULL,
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  reference_type VARCHAR(50),
  reference_id INT,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_account_movements_account FOREIGN KEY (account_id)
    REFERENCES accounts(id)
);

-- =============================================
-- TRIGGERS: updated_at automático
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_income_updated_at BEFORE UPDATE ON income
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_budget_items_updated_at BEFORE UPDATE ON budget_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_investments_updated_at BEFORE UPDATE ON investments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_third_party_accounts_updated_at BEFORE UPDATE ON third_party_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_loans_updated_at BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_credits_updated_at BEFORE UPDATE ON credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 011: ÍNDICES
-- =============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active, deleted_at);

-- Accounts
CREATE INDEX idx_accounts_user ON accounts(user_id, is_active);
CREATE INDEX idx_accounts_type ON accounts(type);

-- Income
CREATE INDEX idx_income_user_date ON income(user_id, date);
CREATE INDEX idx_income_account ON income(account_id);

-- Expenses
CREATE INDEX idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_account ON expenses(account_id);

-- Budget
CREATE INDEX idx_budgets_user_period ON budgets(user_id, period_type);
CREATE INDEX idx_budget_items_budget ON budget_items(budget_id);

-- Investments
CREATE INDEX idx_positions_investment ON positions(investment_id);
CREATE INDEX idx_positions_user_status ON positions(user_id, status);

-- Third party movements
CREATE INDEX idx_third_party_mov_account ON third_party_movements(third_party_account_id);

-- Loans
CREATE INDEX idx_loans_lender ON loans(lender_id);
CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id);

-- Credits
CREATE INDEX idx_credits_user ON credits(user_id);
CREATE INDEX idx_credit_payments_credit ON credit_payments(credit_id);

-- Account movements (audit)
CREATE INDEX idx_account_movements_account ON account_movements(account_id, created_at);

-- =============================================
-- SEED DATA INICIAL
-- =============================================

-- Métodos de pago predeterminados
INSERT INTO payment_methods (name, type) VALUES
  ('Efectivo', 'cash'),
  ('Débito', 'debit'),
  ('Crédito', 'credit'),
  ('Transferencia', 'transfer'),
  ('PSE', 'pse');

-- Categorías predeterminadas
INSERT INTO categories (name, type, icon, color) VALUES
  ('Alimentación', 'expense', 'utensils', '#FF6384'),
  ('Transporte', 'expense', 'car', '#36A2EB'),
  ('Vivienda', 'expense', 'home', '#FFCE56'),
  ('Educación', 'expense', 'book', '#4BC0C0'),
  ('Salud', 'expense', 'heart', '#9966FF'),
  ('Ocio', 'expense', 'smile', '#FF9F40'),
  ('Entretenimiento', 'expense', 'film', '#FF6384'),
  ('Mecato', 'expense', 'coffee', '#C9CBCF'),
  ('Inversiones', 'both', 'trending-up', '#4BC0C0'),
  ('Préstamos', 'both', 'hand-holding-usd', '#FF6384'),
  ('Créditos', 'expense', 'credit-card', '#36A2EB'),
  ('Tarjetas de crédito', 'expense', 'credit-card', '#FFCE56'),
  ('Parqueadero', 'expense', 'parking', '#9966FF'),
  ('Servicios', 'expense', 'bolt', '#FF9F40'),
  ('Impuestos', 'expense', 'file-invoice-dollar', '#C9CBCF'),
  ('Salario', 'income', 'money-bill-wave', '#4BC0C0'),
  ('Otros', 'both', 'ellipsis-h', '#9966FF');
