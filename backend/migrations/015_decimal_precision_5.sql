-- Migration 015: Increase decimal precision from 2 to 5 for all monetary columns

-- income
ALTER TABLE income ALTER COLUMN amount TYPE numeric(15,5);

-- expenses
ALTER TABLE expenses ALTER COLUMN amount TYPE numeric(15,5);

-- account_movements
ALTER TABLE account_movements ALTER COLUMN amount TYPE numeric(15,5);
ALTER TABLE account_movements ALTER COLUMN balance_before TYPE numeric(15,5);
ALTER TABLE account_movements ALTER COLUMN balance_after TYPE numeric(15,5);

-- positions
ALTER TABLE positions ALTER COLUMN unit_price TYPE numeric(15,5);
ALTER TABLE positions ALTER COLUMN commission TYPE numeric(15,5);
ALTER TABLE positions ALTER COLUMN total_cost TYPE numeric(15,5);

-- budget_items
ALTER TABLE budget_items ALTER COLUMN amount TYPE numeric(15,5);

-- third_party_movements
ALTER TABLE third_party_movements ALTER COLUMN amount TYPE numeric(15,5);

-- accounts
ALTER TABLE accounts ALTER COLUMN balance TYPE numeric(15,5);
ALTER TABLE accounts ALTER COLUMN credit_limit TYPE numeric(15,5);
