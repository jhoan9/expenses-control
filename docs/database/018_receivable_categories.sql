-- =============================================
-- 018: CATEGORÍAS DE DEUDA A FAVOR (POR COBRAR)
-- =============================================
--  - categories.is_receivable: la categoría representa una deuda a
--    favor del usuario (dinero prestado). Cada subcategoría dentro =
--    un deudor/persona que le debe.
--  - Es el espejo de categories.is_debt (016), donde cada subcategoría
--    es una persona a la que el usuario debe.
--  - Ambas banderas son excluyentes entre sí.
--  - movements:
--      is_debt       -> ingreso = deuda asumida, gasto = abono
--      is_receivable -> gasto = dinero prestado, ingreso = cobro
--  - subcategories.debt_completed marca el estado "saldado" en ambos
--    casos y se reabre solo si se registra un movimiento nuevo.

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
