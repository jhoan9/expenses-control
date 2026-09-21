-- =============================================
-- 014: VINCULAR INGRESOS A PRÉSTAMOS
-- =============================================
-- Permite que un ingreso represente el cobro de un préstamo (activo):
--  - income.loan_id       -> préstamo asociado (NULL si es ingreso normal)
--  - income.status        -> pending / completed / cancelled
--  - loan_payments.income_id -> loan_payment generado automáticamente desde el ingreso

ALTER TABLE income ADD COLUMN IF NOT EXISTS loan_id INT REFERENCES loans(id) ON DELETE SET NULL;
ALTER TABLE income ADD COLUMN IF NOT EXISTS status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'cancelled')) DEFAULT 'pending';
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS income_id INT REFERENCES income(id) ON DELETE SET NULL;

-- Los ingresos existentes (sin préstamo vinculado) ya fueron recibidos.
UPDATE income SET status = 'completed' WHERE status = 'pending' AND loan_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_income_loan ON income(loan_id);
CREATE INDEX IF NOT EXISTS idx_income_status ON income(status);
CREATE INDEX IF NOT EXISTS idx_loan_payments_income ON loan_payments(income_id);