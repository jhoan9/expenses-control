-- =============================================
-- 012: CANTIDAD RESTANTE POR LOTE (FIFO INVERSIONES)
-- =============================================

ALTER TABLE positions ADD COLUMN IF NOT EXISTS remaining_quantity DECIMAL(20,8);

UPDATE positions SET remaining_quantity = CASE
  WHEN type = 'buy' THEN CASE WHEN status = 'closed' THEN 0 ELSE quantity END
  ELSE quantity
END
WHERE remaining_quantity IS NULL;
