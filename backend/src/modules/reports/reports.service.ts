import { query, queryOne } from '../../config/database';
import { buildFifoLots, Position } from '../investments/investments.service';

interface DateRange {
  date_from?: string;
  date_to?: string;
}

function computeOpenCostBasis(positions: Position[]): number {
  // Group positions by investment to avoid FIFO mixing across different investments
  const byInvestment = new Map<number, Position[]>();
  for (const p of positions) {
    const arr = byInvestment.get(p.investment_id) || [];
    arr.push(p);
    byInvestment.set(p.investment_id, arr);
  }

  let total = 0;
  for (const invPositions of byInvestment.values()) {
    const openLots = buildFifoLots(invPositions).filter(l => l.remaining > 0);
    total += openLots.reduce((sum, l) => {
      const qty = Number(l.buy.quantity);
      const frac = qty > 0 ? l.remaining / qty : 0;
      return sum + Number(l.buy.unit_price) * l.remaining + Number(l.buy.commission) * frac;
    }, 0);
  }

  return Math.round(total * 100000) / 100000;
}

function computeInvestmentDetail(positions: Position[], investment: any): any {
  const invPositions = positions.filter(p => p.investment_id === investment.id);
  if (invPositions.length === 0) return null;

  const lots = buildFifoLots(invPositions);
  const openLots = lots.filter(l => l.remaining > 0);
  const closedLots = lots.filter(l => l.remaining <= 0 && l.sells.length > 0);

  const open_quantity = Math.round(openLots.reduce((s, l) => s + l.remaining, 0) * 1e8) / 1e8;
  const costBasis = openLots.reduce((sum, l) => {
    const qty = Number(l.buy.quantity);
    const frac = qty > 0 ? l.remaining / qty : 0;
    return sum + Number(l.buy.unit_price) * l.remaining + Number(l.buy.commission) * frac;
  }, 0);

  const realizedPnl = closedLots.reduce((sum, l) => sum + l.sells.reduce((s, sell) => s + sell.realized_pnl, 0), 0);
  const totalBought = invPositions.filter(p => p.type === 'buy').reduce((s, p) => s + Number(p.quantity), 0);
  const totalSold = invPositions.filter(p => p.type === 'sell').reduce((s, p) => s + Number(p.quantity), 0);

  return {
    id: investment.id,
    name: investment.name,
    ticker: investment.ticker,
    type: investment.type,
    open_quantity,
    cost_basis: Math.round(costBasis * 100000) / 100000,
    avg_cost: open_quantity > 0 ? Math.round((costBasis / open_quantity) * 100000) / 100000 : 0,
    realized_pnl: Math.round(realizedPnl * 100000) / 100000,
    total_bought: totalBought,
    total_sold: totalSold,
    total_operations: invPositions.length,
    is_closed: open_quantity <= 0 && closedLots.length > 0,
  };
}

export class ReportsService {
  async getDashboard(userId: number): Promise<any> {
    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const accounts = await query<any>(
      'SELECT id, name, type, balance FROM accounts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name',
      [userId]
    );

    const balanceByType: Record<string, number> = {};
    let totalBalance = 0;
    for (const a of accounts) {
      const val = a.type === 'credit_card' ? -Number(a.balance) : Number(a.balance);
      totalBalance += val;
      balanceByType[a.type] = (balanceByType[a.type] || 0) + val;
    }

    const monthlyIncome = await queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM income WHERE user_id = $1 AND deleted_at IS NULL AND date >= $2 AND date <= $3',
      [userId, firstDayMonth, lastDayMonth]
    );

    const monthlyExpenses = await queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = $1 AND deleted_at IS NULL AND status = \'completed\' AND date >= $2 AND date <= $3',
      [userId, firstDayMonth, lastDayMonth]
    );

    const thirdPartyTotal = await queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(total_available), 0) as total FROM third_party_accounts WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    const userPositions = await query<Position>(
      'SELECT p.* FROM positions p JOIN investments i ON i.id = p.investment_id WHERE i.user_id = $1 AND i.deleted_at IS NULL',
      [userId]
    );
    const investmentsSummary = { total_invested: computeOpenCostBasis(userPositions) };

    const loansSummary = await queryOne<{ total_remaining: number }>(
      `SELECT COALESCE(SUM(l.amount - COALESCE(p.total_paid, 0)), 0) as total_remaining
       FROM loans l
       LEFT JOIN (SELECT loan_id, SUM(amount) as total_paid FROM loan_payments GROUP BY loan_id) p ON l.id = p.loan_id
       WHERE l.lender_id = $1 AND l.deleted_at IS NULL AND l.status = 'active'`,
      [userId]
    );

    const creditsSummary = await queryOne<{ total_balance: number }>(
      'SELECT COALESCE(SUM(balance), 0) as total_balance FROM credits WHERE user_id = $1 AND deleted_at IS NULL',
      [userId]
    );

    const recentExpenses = await query(
      `SELECT e.*, c.name as category_name, c.color as category_color
       FROM expenses e
       LEFT JOIN categories c ON e.category_id = c.id
       WHERE e.user_id = $1 AND e.deleted_at IS NULL
       ORDER BY e.date DESC, e.created_at DESC
       LIMIT 5`,
      [userId]
    );

    const recentIncome = await query(
      `SELECT i.*, c.name as category_name
       FROM income i
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE i.user_id = $1 AND i.deleted_at IS NULL
       ORDER BY i.date DESC, i.created_at DESC
       LIMIT 5`,
      [userId]
    );

    return {
      balance: Number(totalBalance) || 0,
      balance_by_type: balanceByType,
      monthly: {
        income: Number(monthlyIncome?.total) || 0,
        expenses: Number(monthlyExpenses?.total) || 0,
        net: (Number(monthlyIncome?.total) || 0) - (Number(monthlyExpenses?.total) || 0),
      },
      third_party: Number(thirdPartyTotal?.total) || 0,
      investments: Number(investmentsSummary?.total_invested) || 0,
      loans: Number(loansSummary?.total_remaining) || 0,
      credits: Number(creditsSummary?.total_balance) || 0,
      recent_expenses: recentExpenses,
      recent_income: recentIncome,
    };
  }

  async getExpensesSummary(userId: number, filters: DateRange): Promise<any> {
    let paramIndex = 1;
    let sql = `SELECT * FROM expenses WHERE user_id = $${paramIndex++} AND deleted_at IS NULL AND status = 'completed'`;
    const params: any[] = [userId];

    if (filters.date_from) {
      sql += ` AND date >= $${paramIndex++}`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date <= $${paramIndex++}`;
      params.push(filters.date_to);
    }

    const total = await queryOne<{ total: number }>(
      sql.replace('SELECT *', 'SELECT COALESCE(SUM(amount), 0) as total'),
      params
    );

    paramIndex = 2;
    const byCategoryParams: any[] = [userId];
    let byCategoryDateClause = '';
    if (filters.date_from) {
      byCategoryDateClause += ` AND e.date >= $${paramIndex++}`;
      byCategoryParams.push(filters.date_from);
    }
    if (filters.date_to) {
      byCategoryDateClause += ` AND e.date <= $${paramIndex++}`;
      byCategoryParams.push(filters.date_to);
    }

    const byCategory = await query(
      `SELECT c.id, c.name, c.color, COALESCE(SUM(e.amount), 0) as total
       FROM categories c
       LEFT JOIN expenses e ON c.id = e.category_id AND e.user_id = $1 AND e.deleted_at IS NULL AND e.status = 'completed'
       ${byCategoryDateClause}
       WHERE c.deleted_at IS NULL AND c.type IN ('expense', 'both')
       GROUP BY c.id, c.name, c.color
       HAVING COALESCE(SUM(e.amount), 0) > 0
       ORDER BY total DESC`,
      byCategoryParams
    );

    paramIndex = 2;
    const byMonthParams: any[] = [userId];
    let byMonthDateClause = '';
    if (filters.date_from) {
      byMonthDateClause += ` AND date >= $${paramIndex++}`;
      byMonthParams.push(filters.date_from);
    }
    if (filters.date_to) {
      byMonthDateClause += ` AND date <= $${paramIndex++}`;
      byMonthParams.push(filters.date_to);
    }

    const byMonth = await query(
      `SELECT TO_CHAR(date, 'YYYY-MM') as month, COALESCE(SUM(amount), 0) as total
       FROM expenses
       WHERE user_id = $1 AND deleted_at IS NULL AND status = 'completed'
       ${byMonthDateClause}
       GROUP BY month
       ORDER BY month DESC`,
      byMonthParams
    );

    paramIndex = 2;
    const byPaymentMethodParams: any[] = [userId];
    let byPaymentMethodDateClause = '';
    if (filters.date_from) {
      byPaymentMethodDateClause += ` AND e.date >= $${paramIndex++}`;
      byPaymentMethodParams.push(filters.date_from);
    }
    if (filters.date_to) {
      byPaymentMethodDateClause += ` AND e.date <= $${paramIndex++}`;
      byPaymentMethodParams.push(filters.date_to);
    }

    const byPaymentMethod = await query(
      `SELECT pm.id, pm.name, COALESCE(SUM(e.amount), 0) as total
       FROM payment_methods pm
       LEFT JOIN expenses e ON pm.id = e.payment_method_id AND e.user_id = $1 AND e.deleted_at IS NULL AND e.status = 'completed'
       ${byPaymentMethodDateClause}
       WHERE pm.is_active = true
       GROUP BY pm.id, pm.name
       HAVING COALESCE(SUM(e.amount), 0) > 0
       ORDER BY total DESC`,
      byPaymentMethodParams
    );

    return {
      total: total?.total || 0,
      by_category: byCategory,
      by_month: byMonth,
      by_payment_method: byPaymentMethod,
    };
  }

  async getIncomeSummary(userId: number, filters: DateRange): Promise<any> {
    let paramIndex = 1;
    let sql = `SELECT * FROM income WHERE user_id = $${paramIndex++} AND deleted_at IS NULL`;
    const params: any[] = [userId];

    if (filters.date_from) {
      sql += ` AND date >= $${paramIndex++}`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND date <= $${paramIndex++}`;
      params.push(filters.date_to);
    }

    const total = await queryOne<{ total: number }>(
      sql.replace('SELECT *', 'SELECT COALESCE(SUM(amount), 0) as total'),
      params
    );

    paramIndex = 2;
    const byCategoryParams: any[] = [userId];
    let byCategoryDateClause = '';
    if (filters.date_from) {
      byCategoryDateClause += ` AND i.date >= $${paramIndex++}`;
      byCategoryParams.push(filters.date_from);
    }
    if (filters.date_to) {
      byCategoryDateClause += ` AND i.date <= $${paramIndex++}`;
      byCategoryParams.push(filters.date_to);
    }

    const byCategory = await query(
      `SELECT c.id, c.name, COALESCE(SUM(i.amount), 0) as total
       FROM categories c
       LEFT JOIN income i ON c.id = i.category_id AND i.user_id = $1 AND i.deleted_at IS NULL
       ${byCategoryDateClause}
       WHERE c.deleted_at IS NULL AND c.type IN ('income', 'both')
       GROUP BY c.id, c.name
       HAVING COALESCE(SUM(i.amount), 0) > 0
       ORDER BY total DESC`,
      byCategoryParams
    );

    paramIndex = 2;
    const byMonthParams: any[] = [userId];
    let byMonthDateClause = '';
    if (filters.date_from) {
      byMonthDateClause += ` AND date >= $${paramIndex++}`;
      byMonthParams.push(filters.date_from);
    }
    if (filters.date_to) {
      byMonthDateClause += ` AND date <= $${paramIndex++}`;
      byMonthParams.push(filters.date_to);
    }

    const byMonth = await query(
      `SELECT TO_CHAR(date, 'YYYY-MM') as month, COALESCE(SUM(amount), 0) as total
       FROM income
       WHERE user_id = $1 AND deleted_at IS NULL
       ${byMonthDateClause}
       GROUP BY month
       ORDER BY month DESC`,
      byMonthParams
    );

    return {
      total: total?.total || 0,
      by_category: byCategory,
      by_month: byMonth,
    };
  }

  async getInvestmentsSummary(userId: number): Promise<any> {
    const investments = await query<any>(
      'SELECT * FROM investments WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name',
      [userId]
    );
    const positions = await query<Position>(
      'SELECT p.* FROM positions p JOIN investments i ON i.id = p.investment_id WHERE i.user_id = $1 AND i.deleted_at IS NULL ORDER BY p.opened_at ASC, p.id ASC',
      [userId]
    );

    const details = investments
      .map((inv: any) => computeInvestmentDetail(positions, inv))
      .filter((r: any) => r !== null);

    const totalInvested = details.reduce((sum: number, p: any) => sum + (p.cost_basis > 0 ? Number(p.cost_basis) : 0), 0);
    const totalRealizedPnl = details.reduce((sum: number, p: any) => sum + Number(p.realized_pnl || 0), 0);

    return {
      positions: details,
      total_invested: totalInvested,
      total_realized_pnl: Math.round(totalRealizedPnl * 100000) / 100000,
    };
  }

  async getAccountsSummary(userId: number): Promise<any> {
    const now = new Date();
    const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDayMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const accounts = await query<any>(
      `SELECT id, name, type, balance FROM accounts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name`,
      [userId]
    );

    const totalBalance = accounts.reduce((sum: number, a: any) =>
      sum + (a.type === 'credit_card' ? -Number(a.balance) : Number(a.balance)), 0);

    const accountDetails = await Promise.all(accounts.map(async (a: any) => {
      const lastMov = await queryOne<any>(
        `SELECT type, amount, description, created_at
         FROM account_movements WHERE account_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [a.id]
      );
      const monthlyIncome = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM account_movements
         WHERE account_id = $1 AND type IN ('income', 'investment_sell', 'transfer')
         AND description LIKE 'Transfer from%' AND created_at >= $2 AND created_at <= $3`,
        [a.id, firstDayMonth, lastDayMonth + ' 23:59:59']
      );
      const monthlyExpenses = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM account_movements
         WHERE account_id = $1 AND type IN ('expense', 'investment_buy')
         AND created_at >= $2 AND created_at <= $3`,
        [a.id, firstDayMonth, lastDayMonth + ' 23:59:59']
      );
      const movCount = await queryOne<{ count: number }>(
        'SELECT COUNT(*) as count FROM account_movements WHERE account_id = $1',
        [a.id]
      );

      return {
        ...a,
        last_movement_type: lastMov?.type || null,
        last_movement_description: lastMov?.description || null,
        last_movement_date: lastMov?.created_at || null,
        monthly_income: Number(monthlyIncome?.total) || 0,
        monthly_expenses: Number(monthlyExpenses?.total) || 0,
        movement_count: Number(movCount?.count) || 0,
      };
    }));

    return {
      accounts: accountDetails,
      total_balance: totalBalance,
    };
  }

  async getBudgetSummary(userId: number, budgetId?: number): Promise<any> {
    let paramIndex = 1;
    let budgetSql = `SELECT * FROM budgets WHERE user_id = $${paramIndex++} AND deleted_at IS NULL`;
    const params: any[] = [userId];

    if (budgetId) {
      budgetSql += ` AND id = $${paramIndex++}`;
      params.push(budgetId);
    }

    budgetSql += ' ORDER BY start_date DESC LIMIT 1';

    const budget = await queryOne(budgetSql, params);

    if (!budget) {
      return { budget: null, items: [], summary: null };
    }

    const items = await query(
      `SELECT *,
        CASE WHEN status = 'completed' THEN amount ELSE 0 END as paid_amount,
        CASE WHEN status = 'pending' THEN amount ELSE 0 END as pending_amount
       FROM budget_items
       WHERE budget_id = $1 AND deleted_at IS NULL
       ORDER BY due_date`,
      [(budget as any).id]
    );

    const summary = await queryOne<{ total_planned: number; total_paid: number; total_pending: number }>(
      `SELECT
        COALESCE(SUM(amount), 0) as total_planned,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending
       FROM budget_items
       WHERE budget_id = $1 AND deleted_at IS NULL`,
      [(budget as any).id]
    );

    return {
      budget,
      items,
      summary: {
        total_income: (budget as any).total_income,
        total_planned: summary?.total_planned || 0,
        total_paid: summary?.total_paid || 0,
        total_pending: summary?.total_pending || 0,
        remaining: ((budget as any).total_income || 0) - (summary?.total_paid || 0),
      },
    };
  }
}

export const reportsService = new ReportsService();
