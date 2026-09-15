-- Migration 019: Allow 'bajo_monto' as an account type
-- The application (validator + frontend) already supports it, but the DB
-- CHECK constraint was never updated, causing 500 errors on INSERT.

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_type_check
  CHECK (type IN ('savings', 'checking', 'cash', 'investment', 'credit_card', 'bajo_monto', 'other'));