-- =============================================
-- 016: CATEGORÍAS DE DEUDA Y SUBCATEGORÍA EN INGRESOS
-- =============================================
--  - categories.is_debt: la categoría representa una deuda.
--    Cada subcategoría dentro = un acreedor/persona.
--  - subcategories.debt_completed: deuda marcada manualmente como saldada.
--  - income.subcategory_id: permitir seleccionar subcategoría en ingresos
--    (igual que ya lo hace expenses.subcategory_id).

ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_debt BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS debt_completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE income ADD COLUMN IF NOT EXISTS subcategory_id INT REFERENCES subcategories(id);

CREATE INDEX IF NOT EXISTS idx_categories_is_debt ON categories(is_debt);
CREATE INDEX IF NOT EXISTS idx_income_subcategory ON income(subcategory_id);