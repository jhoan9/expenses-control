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
  status VARCHAR(20) CHECK (status IN ('active', 'paid', 'cancelled')) DEFAULT 'active',
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
