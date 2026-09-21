-- =============================================
-- 015: REVERTIR VÍNCULO INGRESO ↔ PRÉSTAMO
-- =============================================
-- El manejo de deudas pasará a las categorías/subcategorías,
-- por lo que se eliminan las columnas añadidas en la 014.

ALTER TABLE income DROP COLUMN IF EXISTS loan_id;
ALTER TABLE income DROP COLUMN IF EXISTS status;
ALTER TABLE loan_payments DROP COLUMN IF EXISTS income_id;