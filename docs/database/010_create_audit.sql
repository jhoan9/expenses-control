-- =============================================
-- 010: AUDITORÍA - MOVIMIENTOS DE CUENTAS
-- =============================================

CREATE TABLE IF NOT EXISTS account_movements (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL,
  type VARCHAR(20) CHECK (type IN (
    'income',
    'expense',
    'transfer',
    'investment_buy',
    'investment_sell',
    'loan_disbursement',
    'loan_payment',
    'credit_payment',
    'adjustment'
  )) NOT NULL,
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
