-- =============================================
-- 005: PRESUPUESTO Y OBLIGACIONES
-- =============================================

CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  period_type VARCHAR(20) CHECK (period_type IN ('first', 'second')) NOT NULL,
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
  status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending',
  is_recurrent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_budget_items_budget FOREIGN KEY (budget_id)
    REFERENCES budgets(id) ON DELETE CASCADE
);
