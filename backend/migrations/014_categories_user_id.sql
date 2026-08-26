-- Migration 014: Add user_id to categories for per-user category ownership
-- Categories with user_id = NULL are global (system defaults)
-- Categories with user_id = X are personal to user X

ALTER TABLE categories ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Existing categories become global (user_id = NULL)
-- No data migration needed since column defaults to NULL

CREATE INDEX idx_categories_user_id ON categories(user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN categories.user_id IS 'NULL = global category, integer = personal category for that user';
