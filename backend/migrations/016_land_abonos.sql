-- Migration 016: Land investments + monthly abonos (installment payments)

-- Allow 'land' as an investment type
ALTER TABLE investments DROP CONSTRAINT investments_type_check;
ALTER TABLE investments ADD CONSTRAINT investments_type_check
  CHECK (type IN ('stock', 'bond', 'etf', 'crypto', 'land', 'other'));

-- Optional target/purchase value so progress can be tracked for land
ALTER TABLE investments ADD COLUMN IF NOT EXISTS target_value NUMERIC(15,5);

-- Monthly payments ("abonos") toward a land purchase
CREATE TABLE IF NOT EXISTS investment_abonos (
  id SERIAL PRIMARY KEY,
  investment_id INT NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
  user_id INT NOT NULL REFERENCES users(id),
  amount NUMERIC(15,5) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_investment_abonos_investment ON investment_abonos(investment_id);