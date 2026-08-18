-- =============================================
-- 006: INVERSIONES Y POSICIONES
-- =============================================

CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  ticker VARCHAR(20),
  exchange VARCHAR(50),
  type VARCHAR(20) CHECK (type IN ('stock', 'bond', 'etf', 'crypto', 'other')) NOT NULL,
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
  type VARCHAR(20) CHECK (type IN ('buy', 'sell')) NOT NULL,
  quantity DECIMAL(15,6) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  commission DECIMAL(15,2) DEFAULT 0.00,
  total_cost DECIMAL(15,2) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('open', 'closed')) DEFAULT 'open',
  opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP NULL,
  notes TEXT,
  CONSTRAINT fk_positions_investment FOREIGN KEY (investment_id)
    REFERENCES investments(id),
  CONSTRAINT fk_positions_user FOREIGN KEY (user_id)
    REFERENCES users(id)
);
