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
  type VARCHAR(20) CHECK (type IN ('deposit', 'withdrawal', 'investment_buy', 'investment_sell', 'transfer')) NOT NULL,
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
