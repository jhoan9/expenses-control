import { query, queryOne, execute } from '../../../config/database';
import { AppError } from '../../../shared/errors/AppError';
import { categoriesService } from '../../categories/categories.service';
import { budgetService } from '../../budget/budget.service';
import { normalize } from '../../quick-entry/parser';
import { describeDraft, formatCOP, localToday, quickEntryService, ResolvedDraft } from '../../quick-entry/quick-entry.service';
import { ToolContext, WriteTool } from '../agent/types';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

interface CategoryRow {
  id: number;
  name: string;
  type: 'expense' | 'income' | 'both';
  user_id: number | null;
}

/** Busca una categoría visible para el usuario por id o nombre (exacto primero, luego parcial). */
const findCategory = async (ctx: ToolContext, value: unknown): Promise<CategoryRow> => {
  const cats = await query<CategoryRow>(
    `SELECT id, name, type, user_id FROM categories
      WHERE deleted_at IS NULL AND (user_id IS NULL OR user_id = $1)`,
    [ctx.userId]
  );
  if (value === undefined || value === null || value === '') throw AppError.badRequest('Falta indicar la categoría.');
  const v = String(value);
  // Si hay una categoría propia y una global con el mismo nombre, se prefiere la propia
  const ordered = [...cats].sort((a, b) => Number(b.user_id === ctx.userId) - Number(a.user_id === ctx.userId));
  const found =
    (/^\d+$/.test(v) ? cats.find((c) => c.id === Number(v)) : undefined) ??
    ordered.find((c) => normalize(c.name) === normalize(v)) ??
    ordered.find((c) => normalize(c.name).includes(normalize(v)));
  if (!found) throw AppError.badRequest(`No encontré la categoría "${v}". Usa list_accounts_and_categories para ver los nombres.`);
  return found;
};

const MISSING: Record<string, string> = { kind: 'si es gasto o ingreso', amount: 'el monto', account: 'la cuenta' };

export const registerTransactionTool: WriteTool = {
  kind: 'write',
  name: 'register_transaction',
  label: 'Preparó un registro',
  description:
    'Registra UN gasto o ingreso. Pasa en "text" la frase del usuario (p. ej. "gasté 45 mil en mercado con Nequi ayer") ' +
    'y, si los conoces, los campos explícitos para precisar. Si falta un dato obligatorio devuelve un error indicando cuál: ' +
    'pregúntaselo al usuario. Para varios movimientos, llámala una vez por cada uno.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Descripción en lenguaje natural del movimiento.' },
      kind: { type: 'string', enum: ['expense', 'income'] },
      amount: { type: 'number', description: 'Monto en pesos.' },
      account: { type: 'string', description: 'Nombre exacto de la cuenta.' },
      category: { type: 'string', description: 'Nombre exacto de la categoría.' },
      description: { type: 'string' },
      date: { type: 'string', description: 'YYYY-MM-DD; por defecto hoy.' },
    },
    required: ['text'],
  },
  async prepare(ctx, args) {
    const draft = await quickEntryService.parse(ctx.userId, String(args.text ?? '').slice(0, 500));
    const ctxData = await quickEntryService.getContext(ctx.userId);
    if (args.kind === 'expense' || args.kind === 'income') draft.kind = args.kind;
    if (typeof args.amount === 'number' && args.amount > 0) draft.amount = args.amount;
    if (args.account) {
      const acc =
        ctxData.accounts.find((a) => normalize(a.name) === normalize(String(args.account))) ??
        ctxData.accounts.find((a) => normalize(a.name).includes(normalize(String(args.account))));
      if (!acc) throw AppError.badRequest(`No encontré la cuenta "${args.account}".`);
      draft.account_id = acc.id;
    }
    if (args.category) {
      const cat = await findCategory(ctx, args.category);
      draft.category_id = cat.id;
      draft.subcategory_id = null;
    }
    if (typeof args.description === 'string' && args.description.trim()) draft.description = args.description.trim().slice(0, 200);
    if (typeof args.date === 'string' && ISO.test(args.date)) {
      if (args.date > localToday()) throw AppError.badRequest('La fecha no puede ser futura.');
      draft.date = args.date;
    }

    const resolved: ResolvedDraft = await quickEntryService.resolve(ctx.userId, draft, ctxData, draft.used_ai);
    if (resolved.missing.length) {
      throw AppError.badRequest(`Falta ${resolved.missing.map((m) => MISSING[m]).join(' y ')}. Pregúntaselo al usuario.`);
    }
    const summary = `${describeDraft(resolved)}${resolved.description ? ` — “${resolved.description}”` : ''}`;
    return { summary, args: { draft: resolved, text: args.text } };
  },
  async execute(ctx, args) {
    const result = await quickEntryService.commit(ctx.userId, args.draft as ResolvedDraft, 'assistant', args.text);
    return result.message;
  },
};

export const renameCategoryTool: WriteTool = {
  kind: 'write',
  name: 'rename_category',
  label: 'Propuso renombrar una categoría',
  description:
    'Renombra una categoría PROPIA del usuario. No sirve para categorías globales (compartidas): en ese caso propone ' +
    'create_category + recategorize_transactions.',
  parameters: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Nombre actual o id.' },
      new_name: { type: 'string', description: 'Nombre nuevo, claro y específico (máx. 50 caracteres).' },
    },
    required: ['category', 'new_name'],
  },
  async prepare(ctx, args) {
    const cat = await findCategory(ctx, args.category);
    if (cat.user_id !== ctx.userId) {
      throw AppError.badRequest(
        `"${cat.name}" es una categoría global compartida con otros usuarios; no la renombro. ` +
          'Propón crear una categoría propia con el nombre nuevo y mover allí los movimientos.'
      );
    }
    const newName = String(args.new_name ?? '').trim().slice(0, 50);
    if (newName.length < 2) throw AppError.badRequest('El nombre nuevo es demasiado corto.');
    const clash = await queryOne(
      `SELECT 1 FROM categories WHERE deleted_at IS NULL AND (user_id IS NULL OR user_id = $1)
         AND lower(name) = lower($2) AND id != $3`,
      [ctx.userId, newName, cat.id]
    );
    if (clash) throw AppError.badRequest(`Ya existe una categoría llamada "${newName}".`);
    const [{ count }] = await query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM expenses WHERE category_id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [cat.id, ctx.userId]
    );
    return {
      summary: `Renombrar la categoría “${cat.name}” → “${newName}” (${count} movimientos)`,
      args: { category_id: cat.id, old_name: cat.name, new_name: newName },
    };
  },
  async execute(ctx, args) {
    await categoriesService.update(Number(args.category_id), { name: String(args.new_name) }, ctx.userId);
    return `Listo: la categoría “${args.old_name}” ahora se llama “${args.new_name}”.`;
  },
};

export const createCategoryTool: WriteTool = {
  kind: 'write',
  name: 'create_category',
  label: 'Propuso crear una categoría',
  description: 'Crea una categoría propia del usuario.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      type: { type: 'string', enum: ['expense', 'income', 'both'] },
      color: { type: 'string', description: 'Color hexadecimal #RRGGBB (opcional).' },
    },
    required: ['name', 'type'],
  },
  async prepare(ctx, args) {
    const name = String(args.name ?? '').trim().slice(0, 50);
    if (name.length < 2) throw AppError.badRequest('El nombre es demasiado corto.');
    const type = ['expense', 'income', 'both'].includes(args.type) ? args.type : 'expense';
    const clash = await queryOne(
      `SELECT 1 FROM categories WHERE deleted_at IS NULL AND (user_id IS NULL OR user_id = $1) AND lower(name) = lower($2)`,
      [ctx.userId, name]
    );
    if (clash) throw AppError.badRequest(`Ya existe una categoría llamada "${name}".`);
    const color = typeof args.color === 'string' && /^#[0-9a-f]{6}$/i.test(args.color) ? args.color : undefined;
    const label = type === 'expense' ? 'gastos' : type === 'income' ? 'ingresos' : 'gastos e ingresos';
    return { summary: `Crear la categoría “${name}” para ${label}`, args: { name, type, color } };
  },
  async execute(ctx, args) {
    await categoriesService.create({ name: args.name, type: args.type, color: args.color, user_id: ctx.userId });
    return `Listo: creé la categoría “${args.name}”.`;
  },
};

export const recategorizeTool: WriteTool = {
  kind: 'write',
  name: 'recategorize_transactions',
  label: 'Propuso recategorizar movimientos',
  description:
    'Mueve movimientos (por sus ids, obtenidos con query_transactions o analyze_categories) a otra categoría. ' +
    'Máximo 300 por acción.',
  parameters: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['expense', 'income'] },
      transaction_ids: { type: 'array', items: { type: 'integer' } },
      target_category: { type: 'string', description: 'Nombre o id de la categoría destino.' },
    },
    required: ['kind', 'transaction_ids', 'target_category'],
  },
  async prepare(ctx, args) {
    const kind = args.kind === 'income' ? 'income' : 'expense';
    const ids = [...new Set((Array.isArray(args.transaction_ids) ? args.transaction_ids : []).map(Number).filter(Number.isInteger))];
    if (!ids.length) throw AppError.badRequest('No hay movimientos para mover.');
    if (ids.length > 300) throw AppError.badRequest('Máximo 300 movimientos por acción; divide la operación.');
    const target = await findCategory(ctx, args.target_category);
    if (target.type !== 'both' && target.type !== kind) {
      throw AppError.badRequest(`La categoría "${target.name}" no es de ${kind === 'expense' ? 'gastos' : 'ingresos'}.`);
    }
    const table = kind === 'expense' ? 'expenses' : 'income';
    const rows = await query<{ id: number; amount: string; category: string | null }>(
      `SELECT t.id, t.amount, c.name AS category FROM ${table} t LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.id = ANY($2::int[])`,
      [ctx.userId, ids]
    );
    if (!rows.length) throw AppError.badRequest('Ninguno de esos movimientos te pertenece o existe.');
    const total = rows.reduce((a, r) => a + Number(r.amount), 0);
    const from = [...new Set(rows.map((r) => r.category ?? 'Sin categoría'))].slice(0, 4).join(', ');
    return {
      summary: `Mover ${rows.length} ${kind === 'expense' ? 'gastos' : 'ingresos'} (${formatCOP(total)}) de ${from} a “${target.name}”`,
      args: { kind, ids: rows.map((r) => r.id), category_id: target.id, category_name: target.name },
    };
  },
  async execute(ctx, args) {
    const table = args.kind === 'income' ? 'income' : 'expenses';
    const res = await execute(
      `UPDATE ${table} SET category_id = $1, subcategory_id = NULL
        WHERE user_id = $2 AND deleted_at IS NULL AND id = ANY($3::int[])`,
      [args.category_id, ctx.userId, args.ids]
    );
    return `Listo: moví ${res.rowCount} movimientos a “${args.category_name}”.`;
  },
};

export const createBudgetTool: WriteTool = {
  kind: 'write',
  name: 'create_budget',
  label: 'Propuso un presupuesto',
  description:
    'Crea un presupuesto quincenal con sus partidas. period_type "first" = días 1-15, "second" = 16 a fin de mes. ' +
    'Úsala después de presentar el plan al usuario.',
  parameters: {
    type: 'object',
    properties: {
      period_type: { type: 'string', enum: ['first', 'second'] },
      start_date: { type: 'string', description: 'YYYY-MM-DD' },
      end_date: { type: 'string', description: 'YYYY-MM-DD' },
      total_income: { type: 'number', description: 'Ingreso esperado del periodo.' },
      items: {
        type: 'array',
        description: 'Partidas del presupuesto (máx. 40).',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'number' },
            due_date: { type: 'string', description: 'YYYY-MM-DD dentro del periodo.' },
            is_recurrent: { type: 'boolean' },
            notes: { type: 'string' },
          },
          required: ['name', 'amount', 'due_date'],
        },
      },
    },
    required: ['period_type', 'start_date', 'end_date', 'total_income', 'items'],
  },
  async prepare(_ctx, args) {
    if (!ISO.test(args.start_date) || !ISO.test(args.end_date) || args.start_date > args.end_date) {
      throw AppError.badRequest('Fechas del presupuesto inválidas.');
    }
    const items = (Array.isArray(args.items) ? args.items : []).slice(0, 40).map((i: any) => ({
      name: String(i.name ?? '').trim().slice(0, 100),
      amount: Math.round(Number(i.amount) * 100) / 100,
      due_date: ISO.test(i.due_date) && i.due_date >= args.start_date && i.due_date <= args.end_date ? i.due_date : args.end_date,
      is_recurrent: Boolean(i.is_recurrent),
      notes: typeof i.notes === 'string' ? i.notes.slice(0, 200) : undefined,
    })).filter((i: any) => i.name && i.amount > 0);
    if (!items.length) throw AppError.badRequest('El presupuesto no tiene partidas válidas.');
    const income = Math.max(0, Number(args.total_income) || 0);
    const planned = items.reduce((a: number, i: any) => a + i.amount, 0);
    const summary =
      `Crear presupuesto ${args.period_type === 'first' ? '1.ª' : '2.ª'} quincena (${args.start_date} a ${args.end_date}): ` +
      `${items.length} partidas por ${formatCOP(planned)} con ingreso de ${formatCOP(income)}` +
      (planned > income ? ` ⚠️ supera el ingreso en ${formatCOP(planned - income)}` : ` (sobran ${formatCOP(income - planned)})`);
    return {
      summary,
      args: { period_type: args.period_type, start_date: args.start_date, end_date: args.end_date, total_income: income, items },
    };
  },
  async execute(ctx, args) {
    const budget = await budgetService.create(ctx.userId, {
      period_type: args.period_type,
      start_date: args.start_date,
      end_date: args.end_date,
      total_income: args.total_income,
      cycle: 'biweekly',
      budget_type: 'expense',
    });
    for (const item of args.items) await budgetService.addItem(budget.id, ctx.userId, item);
    return `Listo: creé el presupuesto con ${args.items.length} partidas. Lo encuentras en Presupuesto.`;
  },
};

export const financeWriteTools: WriteTool[] = [
  registerTransactionTool,
  renameCategoryTool,
  createCategoryTool,
  recategorizeTool,
  createBudgetTool,
];
