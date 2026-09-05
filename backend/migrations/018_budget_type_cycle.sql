-- Migration 018: Dynamic budget type + cycle
-- Extends budgets (backwards compatible) with type and cycle selectors
-- Existing budgets get default values (expense / biweekly) preserving behavior

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS budget_type VARCHAR(20)
  CHECK (budget_type IN ('income','expense','remesa','investment','debt','other'))
  DEFAULT 'expense';

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS cycle VARCHAR(20)
  CHECK (cycle IN ('daily','weekly','biweekly','monthly','other'))
  DEFAULT 'biweekly';
