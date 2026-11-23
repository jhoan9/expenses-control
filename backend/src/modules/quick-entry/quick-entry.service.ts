import { query, queryOne, execute } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';
import { expensesService } from '../expenses/expenses.service';
import { incomeService } from '../income/income.service';
import { Draft, EntryKind, ParserAccount, ParserCategory, ParserContext, parseEntry } from './parser';
import { aiParse } from './ai-parser';

export type QuickSource = 'whatsapp' | 'api' | 'web' | 'assistant';

/** Borrador listo para mostrar: ids resueltos + nombres + qué falta. */
export interface ResolvedDraft extends Draft {
  account_name: string | null;
  category_name: string | null;
  subcategory_name: string | null;
  /** Campos obligatorios que faltan: 'kind' | 'amount' | 'account' */
  missing: ('kind' | 'amount' | 'account')[];
  /** true si la cuenta no se nombró y se usó la predeterminada */
  account_defaulted: boolean;
  used_ai: boolean;
}

export interface CommitResult {
  kind: EntryKind;
  id: number;
  amount: number;
  draft: ResolvedDraft;
  message: string;
}

export interface QuickSettings {
  default_expense_account_id: number | null;
  default_income_account_id: number | null;
}

/** Fecha local (YYYY-MM-DD) en la zona horaria configurada. */
export const localToday = (timeZone = env.APP_TIMEZONE): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const formatCOP = (n: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(n)
    .replace(/ /g, ' ');

export const formatDay = (iso: string, today = localToday()): string => {
  if (iso === today) return 'hoy';
  const d = new Date(`${iso}T12:00:00Z`);
  const t = new Date(`${today}T12:00:00Z`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (diff === 1) return 'ayer';
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');
};

/** Resumen de una línea, p. ej. "Gasto · $ 45.000 · Mercado · Nequi · hoy" */
export const describeDraft = (d: ResolvedDraft): string => {
  const parts = [
    d.kind === 'income' ? 'Ingreso' : d.kind === 'expense' ? 'Gasto' : 'Movimiento',
    d.amount != null ? formatCOP(d.amount) : '¿monto?',
    d.subcategory_name ? `${d.category_name} / ${d.subcategory_name}` : d.category_name ?? 'Sin categoría',
    d.account_name ?? '¿cuenta?',
    formatDay(d.date),
  ];
  return parts.join(' · ');
};

const TRANSLATE_ERRORS: [RegExp, string][] = [
  [/insufficient balance/i, 'La cuenta no tiene saldo suficiente para este gasto.'],
  [/credit limit|cupo/i, 'El gasto supera el cupo disponible de la tarjeta.'],
  [/account not found/i, 'No encontré esa cuenta.'],
];

export const friendlyError = (err: unknown): string => {
  const msg = err instanceof Error ? err.message : String(err);
  for (const [re, text] of TRANSLATE_ERRORS) if (re.test(msg)) return text;
  return err instanceof AppError && err.statusCode < 500 ? msg : 'No pude registrar el movimiento. Intenta de nuevo.';
};

export class QuickEntryService {
  async getContext(userId: number): Promise<ParserContext> {
    const accounts = await query<ParserAccount>(
      'SELECT id, name, type FROM accounts WHERE user_id = $1 AND deleted_at IS NULL AND is_active IS NOT FALSE ORDER BY name',
      [userId]
    );
    const categories = await query<ParserCategory & { is_active: boolean }>(
      `SELECT id, name, type FROM categories
        WHERE deleted_at IS NULL AND is_active IS NOT FALSE AND (user_id IS NULL OR user_id = $1)
        ORDER BY name`,
      [userId]
    );
    const subs = await query<{ id: number; name: string; category_id: number }>(
      `SELECT id, name, category_id FROM subcategories
        WHERE deleted_at IS NULL AND is_active IS NOT FALSE AND category_id = ANY($1::int[])`,
      [categories.map((c) => c.id)]
    );
    for (const c of categories) {
      c.subcategories = subs.filter((s) => s.category_id === c.id).map((s) => ({ id: s.id, name: s.name }));
    }
    return { accounts, categories, today: localToday() };
  }

  async getSettings(userId: number): Promise<QuickSettings> {
    const row = await queryOne<QuickSettings>(
      'SELECT default_expense_account_id, default_income_account_id FROM quick_entry_settings WHERE user_id = $1',
      [userId]
    );
    return row ?? { default_expense_account_id: null, default_income_account_id: null };
  }

  async updateSettings(userId: number, data: Partial<QuickSettings>): Promise<QuickSettings> {
    for (const id of [data.default_expense_account_id, data.default_income_account_id]) {
      if (id == null) continue;
      const ok = await queryOne('SELECT 1 FROM accounts WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL', [id, userId]);
      if (!ok) throw AppError.badRequest('La cuenta seleccionada no existe');
    }
    const current = await this.getSettings(userId);
    const next = { ...current, ...data };
    await execute(
      `INSERT INTO quick_entry_settings (user_id, default_expense_account_id, default_income_account_id, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         default_expense_account_id = EXCLUDED.default_expense_account_id,
         default_income_account_id = EXCLUDED.default_income_account_id,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, next.default_expense_account_id ?? null, next.default_income_account_id ?? null]
    );
    return next;
  }

  /**
   * Cuenta a usar cuando el mensaje no nombra ninguna:
   * 1) la predeterminada del usuario, 2) la más usada en 90 días para ese tipo,
   * 3) la única cuenta que no sea tarjeta de crédito.
   */
  private async defaultAccount(userId: number, kind: EntryKind, ctx: ParserContext): Promise<number | null> {
    const settings = await this.getSettings(userId);
    const preferred = kind === 'income' ? settings.default_income_account_id : settings.default_expense_account_id;
    if (preferred && ctx.accounts.some((a) => a.id === preferred)) return preferred;

    const table = kind === 'income' ? 'income' : 'expenses';
    const used = await queryOne<{ account_id: number }>(
      `SELECT account_id FROM ${table}
        WHERE user_id = $1 AND deleted_at IS NULL AND date >= CURRENT_DATE - INTERVAL '90 days'
        GROUP BY account_id ORDER BY COUNT(*) DESC LIMIT 1`,
      [userId]
    );
    if (used && ctx.accounts.some((a) => a.id === used.account_id)) return used.account_id;

    const regular = ctx.accounts.filter((a) => a.type !== 'credit_card');
    return regular.length === 1 ? regular[0].id : null;
  }

  /** Interpreta texto libre. No guarda nada. */
  async parse(userId: number, text: string): Promise<ResolvedDraft> {
    const clean = (text ?? '').trim();
    if (!clean) throw AppError.badRequest('Escribe el gasto o ingreso, por ejemplo: "gasté 45 mil en mercado"');
    if (clean.length > 500) throw AppError.badRequest('El mensaje es demasiado largo (máximo 500 caracteres)');

    const ctx = await this.getContext(userId);
    let draft = parseEntry(clean, ctx);
    let usedAi = false;

    if (!draft.kind || draft.amount == null || draft.category_id == null) {
      const ai = await aiParse(clean, ctx);
      if (ai) {
        usedAi = true;
        draft = {
          kind: draft.kind ?? ai.kind ?? null,
          amount: draft.amount ?? ai.amount ?? null,
          account_id: draft.account_id ?? ai.account_id ?? null,
          category_id: draft.category_id ?? ai.category_id ?? null,
          subcategory_id: draft.category_id != null ? draft.subcategory_id : ai.subcategory_id ?? null,
          description: draft.description || ai.description || '',
          date: draft.date !== ctx.today ? draft.date : ai.date ?? draft.date,
        };
      }
    }

    return this.resolve(userId, draft, ctx, usedAi);
  }

  /** Completa nombres, cuenta por defecto y la lista de faltantes. */
  async resolve(userId: number, draft: Draft, ctx?: ParserContext, usedAi = false): Promise<ResolvedDraft> {
    const context = ctx ?? (await this.getContext(userId));
    let accountId = draft.account_id;
    let defaulted = false;
    if (!accountId && draft.kind) {
      accountId = await this.defaultAccount(userId, draft.kind, context);
      defaulted = accountId != null;
    }

    // La categoría debe ser compatible con el tipo
    let category = context.categories.find((c) => c.id === draft.category_id) ?? null;
    if (category && draft.kind && category.type !== 'both' && category.type !== draft.kind) category = null;
    const sub = category?.subcategories?.find((s) => s.id === draft.subcategory_id) ?? null;
    const account = context.accounts.find((a) => a.id === accountId) ?? null;

    const missing: ResolvedDraft['missing'] = [];
    if (!draft.kind) missing.push('kind');
    if (draft.amount == null || draft.amount <= 0) missing.push('amount');
    if (!account) missing.push('account');

    const description = draft.description || sub?.name || category?.name || '';

    return {
      ...draft,
      account_id: account?.id ?? null,
      category_id: category?.id ?? null,
      subcategory_id: sub?.id ?? null,
      description,
      account_name: account?.name ?? null,
      category_name: category?.name ?? null,
      subcategory_name: sub?.name ?? null,
      missing,
      account_defaulted: defaulted,
      used_ai: usedAi,
    };
  }

  /** Guarda el movimiento con la misma lógica que la web (saldos, movimientos de cuenta). */
  async commit(userId: number, draft: ResolvedDraft, source: QuickSource, originalText?: string): Promise<CommitResult> {
    if (draft.missing.length || !draft.kind || draft.amount == null || !draft.account_id) {
      throw AppError.badRequest('Faltan datos para registrar el movimiento');
    }
    if (draft.date > localToday()) throw AppError.badRequest('La fecha no puede ser futura');

    const base = {
      account_id: draft.account_id,
      category_id: draft.category_id ?? undefined,
      subcategory_id: draft.subcategory_id ?? undefined,
      amount: draft.amount,
      description: draft.description || undefined,
      date: draft.date,
    };

    const record =
      draft.kind === 'expense'
        ? await expensesService.create(userId, { ...base, status: 'completed' })
        : await incomeService.create(userId, base);

    await execute(
      'INSERT INTO quick_entry_log (user_id, source, kind, record_id, original_text) VALUES ($1, $2, $3, $4, $5)',
      [userId, source, draft.kind, record.id, originalText?.slice(0, 500) ?? null]
    );

    return {
      kind: draft.kind,
      id: record.id,
      amount: draft.amount,
      draft,
      message: `${draft.kind === 'expense' ? 'Gasto' : 'Ingreso'} registrado: ${describeDraft(draft).split(' · ').slice(1).join(' · ')}`,
    };
  }

  /** Deshace el último registro hecho por un canal rápido (últimas 24 h). */
  async undoLast(userId: number): Promise<string> {
    const last = await queryOne<{ id: number; kind: EntryKind; record_id: number }>(
      `SELECT id, kind, record_id FROM quick_entry_log
        WHERE user_id = $1 AND undone_at IS NULL AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY id DESC LIMIT 1`,
      [userId]
    );
    if (!last) return 'No hay registros recientes para deshacer.';

    try {
      if (last.kind === 'expense') await expensesService.delete(last.record_id, userId);
      else await incomeService.delete(last.record_id, userId);
    } catch (err) {
      if (!(err instanceof AppError && err.statusCode === 404)) throw err;
      // ya se había borrado desde la web: solo lo marcamos
    }
    await execute('UPDATE quick_entry_log SET undone_at = CURRENT_TIMESTAMP WHERE id = $1', [last.id]);
    return `Listo, eliminé el último ${last.kind === 'expense' ? 'gasto' : 'ingreso'} registrado.`;
  }

  /** Totales del mes en curso para responder "resumen" / "¿cuánto llevo?". */
  async monthSummary(userId: number): Promise<string> {
    const today = localToday();
    const from = `${today.slice(0, 7)}-01`;
    const [exp] = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses
        WHERE user_id = $1 AND deleted_at IS NULL AND status != 'cancelled' AND date BETWEEN $2 AND $3`,
      [userId, from, today]
    );
    const [inc] = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM income
        WHERE user_id = $1 AND deleted_at IS NULL AND date BETWEEN $2 AND $3`,
      [userId, from, today]
    );
    const top = await query<{ name: string; total: string }>(
      `SELECT COALESCE(c.name, 'Sin categoría') AS name, SUM(e.amount) AS total
         FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
        WHERE e.user_id = $1 AND e.deleted_at IS NULL AND e.status != 'cancelled' AND e.date BETWEEN $2 AND $3
        GROUP BY 1 ORDER BY 2 DESC LIMIT 3`,
      [userId, from, today]
    );
    const e = Number(exp.total);
    const i = Number(inc.total);
    const month = new Date(`${today}T12:00:00Z`).toLocaleDateString('es-CO', { month: 'long', timeZone: 'UTC' });
    const lines = [
      `Resumen de ${month}:`,
      `Ingresos: ${formatCOP(i)}`,
      `Gastos: ${formatCOP(e)}`,
      `Neto: ${i - e >= 0 ? '+' : '−'}${formatCOP(Math.abs(i - e))}`,
    ];
    if (top.length) {
      lines.push('', 'Donde más gastas:');
      for (const t of top) lines.push(`• ${t.name}: ${formatCOP(Number(t.total))}`);
    }
    return lines.join('\n');
  }
}

export const quickEntryService = new QuickEntryService();
