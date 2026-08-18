-- =============================================
-- 002: CUENTAS Y MÉTODOS DE PAGO
-- =============================================

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('savings', 'checking', 'cash', 'investment', 'other')) NOT NULL,
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
  type VARCHAR(20) CHECK (type IN ('cash', 'debit', 'credit', 'transfer', 'pse', 'other')) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
