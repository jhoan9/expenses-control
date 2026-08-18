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
  status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'completed',
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
