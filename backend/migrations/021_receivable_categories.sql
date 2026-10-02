-- =============================================
-- 021: CATEGORÍAS DE DEUDA A FAVOR (POR COBRAR)
-- =============================================
--  - categories.is_receivable: la categoría representa dinero prestado
--    por el usuario. Cada subcategoría dentro = deudor/persona que
--    le debe al usuario.
--  - Reutiliza subcategories.debt_completed como marca de "saldado".
--  - Para estas categorías el movimiento que genera la deuda es un
--    EXPENSE (plata que sale) y el que la reduce es un INCOME (cobro).

ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_receivable BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_categories_is_receivable ON categories(is_receivable);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_categories_debt_kind'
  ) THEN
    ALTER TABLE categories
      ADD CONSTRAINT chk_categories_debt_kind
      CHECK (NOT (is_debt AND is_receivable));
  END IF;
END $$;
