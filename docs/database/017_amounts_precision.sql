-- =============================================
-- 017: PRECISIÓN DE DECIMALES EN CANTIDADES
-- =============================================
-- Permite registrar montos como 0.0001 (unidades en ingresos/gastos)
-- y transferencias con decimales, para todos los roles.
-- Cambia DECIMAL(15,2) → DECIMAL(20,8) en todas las columnas monetarias.

ALTER TABLE income ALTER COLUMN amount TYPE DECIMAL(20,8);
ALTER TABLE expenses ALTER COLUMN amount TYPE DECIMAL(20,8);
ALTER TABLE accounts ALTER COLUMN balance TYPE DECIMAL(20,8);
ALTER TABLE accounts ALTER COLUMN credit_limit TYPE DECIMAL(20,8);
ALTER TABLE account_movements ALTER COLUMN amount TYPE DECIMAL(20,8);
ALTER TABLE account_movements ALTER COLUMN balance_before TYPE DECIMAL(20,8);
ALTER TABLE account_movements ALTER COLUMN balance_after TYPE DECIMAL(20,8);
ALTER TABLE loans ALTER COLUMN amount TYPE DECIMAL(20,8);
ALTER TABLE loan_payments ALTER COLUMN amount TYPE DECIMAL(20,8);
ALTER TABLE credits ALTER COLUMN credit_limit TYPE DECIMAL(20,8);
ALTER TABLE credits ALTER COLUMN balance TYPE DECIMAL(20,8);
ALTER TABLE credit_payments ALTER COLUMN amount TYPE DECIMAL(20,8);