-- Migration 017: Add date column to account_movements
-- Stores the actual transaction date (not just created_at)

ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS date DATE;

-- Backfill existing movements from created_at timestamp
UPDATE account_movements SET date = created_at::date WHERE date IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE account_movements ALTER COLUMN date SET NOT NULL;
ALTER TABLE account_movements ALTER COLUMN date SET DEFAULT CURRENT_DATE;