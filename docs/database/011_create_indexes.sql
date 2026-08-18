-- =============================================
-- 011: ÍNDICES
-- =============================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active, deleted_at);

-- Accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);

-- Income
CREATE INDEX IF NOT EXISTS idx_income_user_date ON income(user_id, date);
CREATE INDEX IF NOT EXISTS idx_income_account ON income(account_id);

-- Expenses
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_account ON expenses(account_id);

-- Budget
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON budgets(user_id, period_type);
CREATE INDEX IF NOT EXISTS idx_budget_items_budget ON budget_items(budget_id);

-- Investments
CREATE INDEX IF NOT EXISTS idx_positions_investment ON positions(investment_id);
CREATE INDEX IF NOT EXISTS idx_positions_user_status ON positions(user_id, status);

-- Third party movements
CREATE INDEX IF NOT EXISTS idx_third_party_mov_account ON third_party_movements(third_party_account_id);

-- Loans
CREATE INDEX IF NOT EXISTS idx_loans_lender ON loans(lender_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);

-- Credits
CREATE INDEX IF NOT EXISTS idx_credits_user ON credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_payments_credit ON credit_payments(credit_id);

-- Account movements (audit)
CREATE INDEX IF NOT EXISTS idx_account_movements_account ON account_movements(account_id, created_at);
