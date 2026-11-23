import { query } from '../../../config/database';
import { AppError } from '../../../shared/errors/AppError';
import { buildFinancialContext } from '../financial-context';
import { localToday } from '../../quick-entry/quick-entry.service';
import { CATEGORY_SYNONYMS, normalize } from '../../quick-entry/parser';
import { ReadTool } from '../agent/types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const shiftDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000) + 1;

/** Valida un rango; por defecto el mes en curso. Máximo 5 años. */
export const resolveRange = (from?: string, to?: string): { from: string; to: string } => {
  const today = localToday();
  const end = to && ISO.test(to) ? to : today;
  const start = from && ISO.test(from) ? from : `${end.slice(0, 7)}-01`;
  if (start > end) throw AppError.badRequest('La fecha inicial es posterior a la final.');
  if (daysBetween(start, end) > 1830) throw AppError.badRequest('El rango máximo es de 5 años.');
  return { from: start, to: end };
};

const num = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

/** Filtro de categoría/cuenta por nombre (ILIKE) o id. */
const nameFilter = (column: string, value: unknown, params: unknown[]): string => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    params.push(Number(value));
    return ` AND ${column}_id = $${params.length}`;
  }
  params.push(`%${String(value).trim()}%`);
  return ` AND ${column === 'c' ? 'c.name' : 'a.name'} ILIKE $${params.length}`;
};

const DATE_PARAMS = {
  date_from: { type: 'string', description: 'Fecha inicial YYYY-MM-DD (incluida). Por defecto, el primer día del mes actual.' },
  date_to: { type: 'string', description: 'Fecha final YYYY-MM-DD (incluida). Por defecto, hoy.' },
};

export const financialOverviewTool: ReadTool = {
  kind: 'read',
  name: 'get_financial_overview',
  label: 'Revisó tu resumen financiero',
  description:
    'Resumen actual del usuario: saldos por cuenta, ingresos y gastos del mes, obligaciones de presupuesto pendientes, ' +
    'inversiones abiertas, préstamos, créditos, cuentas de terceros y últimos gastos. Úsala para preguntas generales.',
  parameters: { type: 'object', properties: {} },
  async run(ctx) {
    return { today: localToday(), overview: await buildFinancialContext(ctx.userId) };
  },
};

export const accountsAndCategoriesTool: ReadTool = {
  kind: 'read',
  name: 'list_accounts_and_categories',
  label: 'Consultó tus cuentas y categorías',
  description:
    'Lista las cuentas (nombre, tipo, saldo) y las categorías disponibles (tipo, si son propias o globales, subcategorías ' +
    'y cuántos movimientos tuvieron en los últimos 12 meses). Úsala antes de registrar o recategorizar para usar nombres exactos.',
  parameters: { type: 'object', properties: {} },
  async run(ctx) {
    const accounts = await query(
      `SELECT id, name, type, balance::float AS balance, credit_limit::float AS credit_limit
         FROM accounts WHERE user_id = $1 AND deleted_at IS NULL ORDER BY name`,
      [ctx.userId]
    );
    const categories = await query<any>(
      `SELECT c.id, c.name, c.type, (c.user_id IS NOT NULL) AS own, c.is_active,
              (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id AND e.user_id = $1 AND e.deleted_at IS NULL
                 AND e.date >= CURRENT_DATE - INTERVAL '12 months')::int AS expenses_12m,
              (SELECT COUNT(*) FROM income i WHERE i.category_id = c.id AND i.user_id = $1 AND i.deleted_at IS NULL
                 AND i.date >= CURRENT_DATE - INTERVAL '12 months')::int AS income_12m,
              COALESCE((SELECT json_agg(s.name ORDER BY s.name) FROM subcategories s
                 WHERE s.category_id = c.id AND s.deleted_at IS NULL), '[]') AS subcategories
         FROM categories c
        WHERE c.deleted_at IS NULL AND (c.user_id IS NULL OR c.user_id = $1)
        ORDER BY c.name`,
      [ctx.userId]
    );
    return { accounts, categories };
  },
};

export const queryTransactionsTool: ReadTool = {
  kind: 'read',
  name: 'query_transactions',
  label: 'Consultó tus movimientos',
  description:
    'Busca gastos y/o ingresos con filtros (fechas, categoría, cuenta, texto, montos). Devuelve los movimientos y los totales ' +
    'del filtro completo (aunque la lista esté limitada). Úsala para "¿cuánto gasté en X?", "muéstrame mis gastos de…", etc.',
  parameters: {
    type: 'object',
    properties: {
      ...DATE_PARAMS,
      kind: { type: 'string', enum: ['expense', 'income', 'all'], description: 'Tipo de movimiento. Por defecto "all".' },
      category: { type: 'string', description: 'Nombre (o parte) de la categoría, o su id.' },
      account: { type: 'string', description: 'Nombre (o parte) de la cuenta, o su id.' },
      search: { type: 'string', description: 'Texto a buscar en la descripción.' },
      min_amount: { type: 'number' },
      max_amount: { type: 'number' },
      uncategorized: { type: 'boolean', description: 'Solo movimientos sin categoría.' },
      order: { type: 'string', enum: ['date_desc', 'amount_desc'], description: 'Orden. Por defecto por fecha.' },
      limit: { type: 'integer', description: 'Máximo de filas a devolver (1-200, por defecto 50).' },
    },
  },
  async run(ctx, args) {
    const { from, to } = resolveRange(args.date_from, args.date_to);
    const kinds: ('expense' | 'income')[] = args.kind === 'expense' ? ['expense'] : args.kind === 'income' ? ['income'] : ['expense', 'income'];
    const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);
    const parts: string[] = [];
    const params: unknown[] = [ctx.userId, from, to];

    for (const kind of kinds) {
      const table = kind === 'expense' ? 'expenses' : 'income';
      let where = `t.user_id = $1 AND t.deleted_at IS NULL AND t.date BETWEEN $2 AND $3`;
      if (kind === 'expense') where += ` AND t.status != 'cancelled'`;
      where += nameFilter('c', args.category, params).replace('c_id', 't.category_id');
      where += nameFilter('a', args.account, params).replace('a_id', 't.account_id');
      if (args.search) {
        params.push(`%${String(args.search).trim()}%`);
        where += ` AND t.description ILIKE $${params.length}`;
      }
      if (args.min_amount != null) {
        params.push(Number(args.min_amount));
        where += ` AND t.amount >= $${params.length}`;
      }
      if (args.max_amount != null) {
        params.push(Number(args.max_amount));
        where += ` AND t.amount <= $${params.length}`;
      }
      if (args.uncategorized) where += ' AND t.category_id IS NULL';
      parts.push(
        `SELECT '${kind}' AS kind, t.id, t.date::text AS date, t.amount::float AS amount, t.description,
                c.name AS category, s.name AS subcategory, a.name AS account
           FROM ${table} t
           LEFT JOIN categories c ON c.id = t.category_id
           LEFT JOIN subcategories s ON s.id = t.subcategory_id
           LEFT JOIN accounts a ON a.id = t.account_id
          WHERE ${where}`
      );
    }

    const union = parts.join(' UNION ALL ');
    const order = args.order === 'amount_desc' ? 'amount DESC' : 'date DESC, id DESC';
    const rows = await query(`SELECT * FROM (${union}) x ORDER BY ${order} LIMIT ${limit}`, params);
    const totals = await query<{ kind: string; count: string; total: string }>(
      `SELECT kind, COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM (${union}) x GROUP BY kind`,
      params
    );
    const summary: Record<string, { count: number; total: number }> = {};
    for (const t of totals) summary[t.kind] = { count: Number(t.count), total: num(t.total) };
    const shown = rows.length;
    const totalCount = Object.values(summary).reduce((a, s) => a + s.count, 0);
    return { range: { from, to }, totals: summary, shown, total_count: totalCount, transactions: rows };
  },
};

interface Agg { name: string; total: number; count: number }

const sumBy = async (userId: number, table: 'expenses' | 'income', from: string, to: string, by: 'category' | 'account' | 'month') => {
  const status = table === 'expenses' ? ` AND t.status != 'cancelled'` : '';
  const select =
    by === 'category'
      ? `COALESCE(c.name, 'Sin categoría')`
      : by === 'account'
        ? `COALESCE(a.name, 'Sin cuenta')`
        : `to_char(t.date, 'YYYY-MM')`;
  const rows = await query<{ name: string; total: string; count: string }>(
    `SELECT ${select} AS name, SUM(t.amount) AS total, COUNT(*) AS count
       FROM ${table} t
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN accounts a ON a.id = t.account_id
      WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.date BETWEEN $2 AND $3${status}
      GROUP BY 1 ORDER BY ${by === 'month' ? '1' : '2 DESC'}`,
    [userId, from, to]
  );
  return rows.map<Agg>((r) => ({ name: r.name, total: num(r.total), count: Number(r.count) }));
};

const total = (list: Agg[]) => num(list.reduce((a, r) => a + r.total, 0));

export const financialReportTool: ReadTool = {
  kind: 'read',
  name: 'financial_report',
  label: 'Generó un informe financiero',
  description:
    'Informe completo de un rango de fechas: ingresos, gastos, neto y tasa de ahorro; gastos e ingresos por categoría ' +
    '(con %), por mes y por cuenta; gastos más grandes; gastos recurrentes (suscripciones); y comparación con el periodo ' +
    'anterior de igual duración. Úsala para "informe/reporte/detalle de mis finanzas entre fechas".',
  parameters: { type: 'object', properties: { ...DATE_PARAMS } },
  async run(ctx, args) {
    const { from, to } = resolveRange(args.date_from, args.date_to);
    const days = daysBetween(from, to);
    const prevTo = shiftDays(from, -1);
    const prevFrom = shiftDays(prevTo, -(days - 1));

    const [expCat, incCat, expMonth, incMonth, expAcc, prevExpCat, prevIncCat] = await Promise.all([
      sumBy(ctx.userId, 'expenses', from, to, 'category'),
      sumBy(ctx.userId, 'income', from, to, 'category'),
      sumBy(ctx.userId, 'expenses', from, to, 'month'),
      sumBy(ctx.userId, 'income', from, to, 'month'),
      sumBy(ctx.userId, 'expenses', from, to, 'account'),
      sumBy(ctx.userId, 'expenses', prevFrom, prevTo, 'category'),
      sumBy(ctx.userId, 'income', prevFrom, prevTo, 'category'),
    ]);

    const expenses = total(expCat);
    const income = total(incCat);
    const prevExpenses = total(prevExpCat);
    const prevIncome = total(prevIncCat);

    const largest = await query(
      `SELECT e.date::text AS date, e.amount::float AS amount, e.description, c.name AS category, a.name AS account
         FROM expenses e LEFT JOIN categories c ON c.id = e.category_id LEFT JOIN accounts a ON a.id = e.account_id
        WHERE e.user_id = $1 AND e.deleted_at IS NULL AND e.status != 'cancelled' AND e.date BETWEEN $2 AND $3
        ORDER BY e.amount DESC LIMIT 10`,
      [ctx.userId, from, to]
    );

    // Recurrentes: misma descripción en 2+ meses distintos durante los últimos 6 meses
    const recurring = await query(
      `SELECT lower(trim(e.description)) AS description, COUNT(DISTINCT to_char(e.date, 'YYYY-MM'))::int AS months,
              ROUND(AVG(e.amount)::numeric, 0)::float AS avg_amount, MAX(c.name) AS category
         FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
        WHERE e.user_id = $1 AND e.deleted_at IS NULL AND e.status != 'cancelled'
          AND e.description IS NOT NULL AND length(trim(e.description)) > 2
          AND e.date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY 1 HAVING COUNT(DISTINCT to_char(e.date, 'YYYY-MM')) >= 2
        ORDER BY 3 DESC LIMIT 15`,
      [ctx.userId]
    );

    const prevByCat = new Map(prevExpCat.map((c) => [c.name, c.total]));
    return {
      range: { from, to, days },
      totals: {
        income,
        expenses,
        net: num(income - expenses),
        savings_rate_pct: pct(income - expenses, income),
        avg_daily_expense: num(expenses / days),
      },
      previous_period: {
        range: { from: prevFrom, to: prevTo },
        income: prevIncome,
        expenses: prevExpenses,
        expenses_change_pct: prevExpenses ? pct(expenses - prevExpenses, prevExpenses) : null,
        income_change_pct: prevIncome ? pct(income - prevIncome, prevIncome) : null,
      },
      expenses_by_category: expCat.map((c) => ({
        ...c,
        pct: pct(c.total, expenses),
        previous: prevByCat.get(c.name) ?? 0,
      })),
      income_by_category: incCat.map((c) => ({ ...c, pct: pct(c.total, income) })),
      by_month: expMonth.map((m) => ({
        month: m.name,
        expenses: m.total,
        income: incMonth.find((i) => i.name === m.name)?.total ?? 0,
      })).concat(
        incMonth.filter((i) => !expMonth.some((m) => m.name === i.name)).map((i) => ({ month: i.name, expenses: 0, income: i.total }))
      ).sort((a, b) => a.month.localeCompare(b.month)),
      expenses_by_account: expAcc,
      largest_expenses: largest,
      recurring_expenses: recurring,
    };
  },
};

export const budgetPlanningDataTool: ReadTool = {
  kind: 'read',
  name: 'budget_planning_data',
  label: 'Analizó tu historial para el presupuesto',
  description:
    'Datos para elaborar un presupuesto: promedio mensual de ingresos y de gastos por categoría en los últimos N meses ' +
    '(con mínimo y máximo), gastos recurrentes, deudas (créditos y préstamos), obligaciones pendientes y presupuestos ' +
    'existentes. Úsala antes de proponer un plan de presupuesto.',
  parameters: {
    type: 'object',
    properties: {
      months: { type: 'integer', description: 'Meses completos de historial a analizar (1-12, por defecto 3).' },
    },
  },
  async run(ctx, args) {
    const months = Math.min(Math.max(Number(args.months) || 3, 1), 12);
    const today = localToday();
    const firstOfMonth = `${today.slice(0, 7)}-01`;
    const to = shiftDays(firstOfMonth, -1);
    const fromDate = new Date(`${firstOfMonth}T12:00:00Z`);
    fromDate.setUTCMonth(fromDate.getUTCMonth() - months);
    const from = fromDate.toISOString().slice(0, 10);

    const perCategory = await query<any>(
      `WITH m AS (
         SELECT COALESCE(c.name, 'Sin categoría') AS category, to_char(e.date, 'YYYY-MM') AS month, SUM(e.amount) AS total
           FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
          WHERE e.user_id = $1 AND e.deleted_at IS NULL AND e.status != 'cancelled' AND e.date BETWEEN $2 AND $3
          GROUP BY 1, 2)
       SELECT category, ROUND(SUM(total) / $4::numeric, 0)::float AS monthly_avg,
              MIN(total)::float AS min_month, MAX(total)::float AS max_month, COUNT(*)::int AS months_with_spend
         FROM m GROUP BY 1 ORDER BY 2 DESC`,
      [ctx.userId, from, to, months]
    );
    const [inc] = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM income
        WHERE user_id = $1 AND deleted_at IS NULL AND date BETWEEN $2 AND $3`,
      [ctx.userId, from, to]
    );
    const monthlyIncome = num(Number(inc.total) / months);
    const monthlyExpense = num(perCategory.reduce((a: number, c: any) => a + Number(c.monthly_avg), 0));

    const [credits, loans, budgets, balances] = await Promise.all([
      query(`SELECT * FROM credits WHERE user_id = $1 AND deleted_at IS NULL LIMIT 20`, [ctx.userId]).catch(() => []),
      query(`SELECT * FROM loans WHERE user_id = $1 AND deleted_at IS NULL LIMIT 20`, [ctx.userId]).catch(() => []),
      query(
        `SELECT b.id, b.period_type, b.cycle, b.start_date::text, b.end_date::text, b.total_income::float,
                COALESCE(SUM(bi.amount), 0)::float AS items_total, COUNT(bi.id)::int AS items
           FROM budgets b LEFT JOIN budget_items bi ON bi.budget_id = b.id AND bi.deleted_at IS NULL
          WHERE b.user_id = $1 AND b.deleted_at IS NULL AND b.end_date >= CURRENT_DATE - INTERVAL '60 days'
          GROUP BY b.id ORDER BY b.start_date DESC LIMIT 6`,
        [ctx.userId]
      ),
      query(
        `SELECT name, type, balance::float AS balance FROM accounts WHERE user_id = $1 AND deleted_at IS NULL`,
        [ctx.userId]
      ),
    ]);

    // Sin meses completos de historial: se usa lo que va del mes como referencia
    let currentMonth: unknown = null;
    if (!perCategory.length || monthlyIncome === 0) {
      const [cm] = await query<any>(
        `SELECT
           (SELECT COALESCE(SUM(amount), 0) FROM income WHERE user_id = $1 AND deleted_at IS NULL AND date BETWEEN $2 AND $3)::float AS income,
           (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE user_id = $1 AND deleted_at IS NULL AND status != 'cancelled' AND date BETWEEN $2 AND $3)::float AS expenses`,
        [ctx.userId, firstOfMonth, today]
      );
      const cmCats = await query(
        `SELECT COALESCE(c.name, 'Sin categoría') AS category, SUM(e.amount)::float AS total
           FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
          WHERE e.user_id = $1 AND e.deleted_at IS NULL AND e.status != 'cancelled' AND e.date BETWEEN $2 AND $3
          GROUP BY 1 ORDER BY 2 DESC`,
        [ctx.userId, firstOfMonth, today]
      );
      currentMonth = {
        note: 'No hay meses completos con datos; esto es lo que va del mes actual (parcial). Úsalo con cautela.',
        range: { from: firstOfMonth, to: today },
        ...cm,
        expenses_by_category: cmCats,
      };
    }

    return {
      analyzed_range: { from, to, months },
      current_month_partial: currentMonth,
      monthly_income_avg: monthlyIncome,
      monthly_expense_avg: monthlyExpense,
      monthly_surplus_avg: num(monthlyIncome - monthlyExpense),
      expenses_by_category: perCategory,
      accounts: balances,
      credits,
      loans,
      recent_budgets: budgets,
      note: 'Los presupuestos de la app son por quincena (period_type first = 1-15, second = 16-fin de mes).',
    };
  },
};

const VAGUE = ['otros', 'otro', 'varios', 'general', 'misc', 'miscelaneos', 'gastos', 'cosas', 'extra', 'extras', 'nueva categoria', 'sin nombre', 'prueba', 'test'];

export const analyzeCategoriesTool: ReadTool = {
  kind: 'read',
  name: 'analyze_categories',
  label: 'Analizó tus categorías',
  description:
    'Revisa la calidad de las categorías de los últimos 12 meses: nombres poco claros, categorías casi sin uso, nombres ' +
    'duplicados o parecidos, movimientos sin categoría y movimientos que parecen estar en la categoría equivocada (según ' +
    'su descripción), con ejemplos e ids. Úsala para proponer renombrar, unificar o recategorizar.',
  parameters: { type: 'object', properties: {} },
  async run(ctx) {
    const cats = await query<any>(
      `SELECT c.id, c.name, c.type, (c.user_id IS NOT NULL) AS own,
              COUNT(e.id)::int AS movements, COALESCE(SUM(e.amount), 0)::float AS total
         FROM categories c
         LEFT JOIN expenses e ON e.category_id = c.id AND e.user_id = $1 AND e.deleted_at IS NULL
              AND e.date >= CURRENT_DATE - INTERVAL '12 months'
        WHERE c.deleted_at IS NULL AND (c.user_id IS NULL OR c.user_id = $1)
        GROUP BY c.id ORDER BY movements DESC`,
      [ctx.userId]
    );

    const vague = cats.filter((c: any) => VAGUE.includes(normalize(c.name)) || normalize(c.name).length <= 2);
    const unused = cats.filter((c: any) => c.type !== 'income' && c.movements === 0);

    // Nombres parecidos entre categorías visibles; se marca si una es global y la otra propia
    const duplicates: { a: string; b: string; kind: string }[] = [];
    for (let i = 0; i < cats.length; i++) {
      for (let j = i + 1; j < cats.length; j++) {
        const a = normalize(cats[i].name).replace(/s$/, '');
        const b = normalize(cats[j].name).replace(/s$/, '');
        if (a === b || (a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a)))) {
          duplicates.push({
            a: `${cats[i].name}${cats[i].own ? '' : ' (global)'}`,
            b: `${cats[j].name}${cats[j].own ? '' : ' (global)'}`,
            kind: a === b && cats[i].own !== cats[j].own ? 'propia duplicada de una global' : 'nombres parecidos',
          });
        }
      }
    }

    const expenses = await query<any>(
      `SELECT e.id, e.date::text AS date, e.amount::float AS amount, e.description, e.category_id, c.name AS category
         FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
        WHERE e.user_id = $1 AND e.deleted_at IS NULL AND e.date >= CURRENT_DATE - INTERVAL '12 months'
          AND e.description IS NOT NULL
        ORDER BY e.date DESC LIMIT 2000`,
      [ctx.userId]
    );

    // Palabras de la descripción que apuntan a otra categoría existente del usuario.
    // Con nombres repetidos (propia + global) gana la propia, luego la más usada.
    const byName = new Map<string, any>();
    for (const c of [...cats].sort((a: any, b: any) => Number(a.own) - Number(b.own) || a.movements - b.movements)) {
      byName.set(normalize(c.name), c);
    }
    const misplaced = new Map<string, { from: string; to: string; ids: number[]; total: number; examples: string[] }>();
    for (const e of expenses) {
      const text = ` ${normalize(e.description)} `;
      for (const group of CATEGORY_SYNONYMS) {
        if (!group.words.some((w) => text.includes(` ${w} `))) continue;
        const target = group.categories.map((n) => byName.get(n)).find(Boolean) as any;
        if (!target || target.id === e.category_id || target.type === 'income') continue;
        if (e.category && normalize(e.category) === normalize(target.name)) continue; // ya está en una homónima
        const key = `${e.category ?? 'Sin categoría'}→${target.name}`;
        const entry = misplaced.get(key) ?? { from: e.category ?? 'Sin categoría', to: target.name, ids: [] as number[], total: 0, examples: [] as string[] };
        entry.ids.push(e.id);
        entry.total = num(entry.total + e.amount);
        if (entry.examples.length < 4) entry.examples.push(`${e.date} ${e.description} $${e.amount}`);
        misplaced.set(key, entry);
        break;
      }
    }

    const uncategorized = await query<any>(
      `SELECT COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float AS total FROM expenses
        WHERE user_id = $1 AND deleted_at IS NULL AND category_id IS NULL AND date >= CURRENT_DATE - INTERVAL '12 months'`,
      [ctx.userId]
    );

    // Descripciones más frecuentes por categoría (para detectar nombres poco representativos)
    const topWords = await query<any>(
      `SELECT c.name AS category, lower(trim(e.description)) AS description, COUNT(*)::int AS times
         FROM expenses e JOIN categories c ON c.id = e.category_id
        WHERE e.user_id = $1 AND e.deleted_at IS NULL AND e.date >= CURRENT_DATE - INTERVAL '12 months'
          AND e.description IS NOT NULL
        GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 40`,
      [ctx.userId]
    );

    return {
      categories: cats,
      vague_names: vague.map((c: any) => ({ id: c.id, name: c.name, own: c.own, movements: c.movements, total: c.total })),
      unused_expense_categories: unused.map((c: any) => ({ id: c.id, name: c.name, own: c.own })),
      similar_names: duplicates,
      possibly_misplaced: [...misplaced.values()].sort((a, b) => b.ids.length - a.ids.length).slice(0, 10),
      uncategorized_last_12m: uncategorized[0],
      frequent_descriptions_by_category: topWords,
      note: 'Solo se pueden renombrar categorías propias (own = true). Las globales son compartidas por todos los usuarios.',
    };
  },
};

export const financeReadTools: ReadTool[] = [
  financialOverviewTool,
  accountsAndCategoriesTool,
  queryTransactionsTool,
  financialReportTool,
  budgetPlanningDataTool,
  analyzeCategoriesTool,
];
