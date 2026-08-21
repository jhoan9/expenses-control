-- =============================================
-- 011: ITEMS DE GASTOS Y PLANTILLAS
-- =============================================

CREATE TABLE IF NOT EXISTS item_templates (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  subcategory_id INT,
  name VARCHAR(200) NOT NULL,
  position INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  CONSTRAINT fk_item_tpl_user FOREIGN KEY (user_id)
    REFERENCES users(id),
  CONSTRAINT fk_item_tpl_category FOREIGN KEY (category_id)
    REFERENCES categories(id),
  CONSTRAINT fk_item_tpl_subcategory FOREIGN KEY (subcategory_id)
    REFERENCES subcategories(id)
);

CREATE INDEX IF NOT EXISTS idx_item_templates_user_cat
  ON item_templates(user_id, category_id, subcategory_id);

CREATE TABLE IF NOT EXISTS expense_items (
  id SERIAL PRIMARY KEY,
  expense_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_expense_items_expense FOREIGN KEY (expense_id)
    REFERENCES expenses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_expense_items_expense
  ON expense_items(expense_id);
