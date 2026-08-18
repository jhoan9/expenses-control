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
