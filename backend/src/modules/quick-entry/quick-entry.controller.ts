import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth.middleware';
import { AppError } from '../../shared/errors/AppError';
import { Draft, EntryKind, normalize } from './parser';
import { describeDraft, friendlyError, quickEntryService, QuickSource, ResolvedDraft } from './quick-entry.service';
import { extractAmount } from './amount';

const MISSING_TEXT: Record<string, string> = {
  kind: 'si es un gasto o un ingreso',
  amount: 'el monto',
  account: 'la cuenta',
};

const missingMessage = (d: ResolvedDraft): string =>
  `Me falta ${d.missing.map((m) => MISSING_TEXT[m]).join(' y ')}. ` +
  'Ejemplo: "gasté 45 mil en mercado con Nequi".';

/**
 * Responde en JSON o, con ?format=text, en texto plano (lo más simple para
 * Atajos de iPhone o un widget de Android que solo muestra/lee la respuesta).
 */
const reply = (req: AuthRequest, res: Response, status: number, message: string, data?: unknown) => {
  if (req.query.format === 'text') {
    res.status(status).type('text/plain; charset=utf-8').send(message);
    return;
  }
  res.status(status).json({ success: status < 400, message, data });
};

const byName = <T extends { id: number; name: string }>(list: T[], value: unknown): T | null => {
  if (value == null || value === '') return null;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    return list.find((x) => x.id === Number(value)) ?? null;
  }
  const v = normalize(String(value));
  return (
    list.find((x) => normalize(x.name) === v) ??
    list.find((x) => normalize(x.name).includes(v) || v.includes(normalize(x.name))) ??
    null
  );
};

export class QuickEntryController {
  private source(req: AuthRequest): QuickSource {
    return req.authVia === 'token' ? 'api' : 'web';
  }

  /** Construye el borrador desde texto libre o desde campos sueltos. */
  private async buildDraft(req: AuthRequest): Promise<{ draft: ResolvedDraft; text?: string }> {
    const userId = req.userId!;
    const body = req.body ?? {};
    const text = typeof body.text === 'string' ? body.text : typeof req.query.text === 'string' ? req.query.text : '';

    if (text.trim()) {
      const draft = await quickEntryService.parse(userId, text);
      // Campos explícitos (kind, account, category) tienen prioridad sobre lo interpretado
      const hasOverrides = body.kind === 'expense' || body.kind === 'income' || body.account || body.category;
      if (!hasOverrides) return { draft, text };

      const ctx = await quickEntryService.getContext(userId);
      if (body.kind === 'expense' || body.kind === 'income') draft.kind = body.kind;
      if (body.account) {
        const account = byName(ctx.accounts, body.account);
        if (!account) throw AppError.badRequest(`No encontré la cuenta "${body.account}"`);
        draft.account_id = account.id;
      }
      if (body.category) {
        const category = byName(
          ctx.categories.filter((c) => !draft.kind || c.type === 'both' || c.type === draft.kind),
          body.category
        );
        if (category) {
          draft.category_id = category.id;
          draft.subcategory_id = null;
        }
      }
      return { draft: await quickEntryService.resolve(userId, draft, ctx, draft.used_ai), text };
    }

    // Modo estructurado: { kind, amount, account, category, description, date }
    const ctx = await quickEntryService.getContext(userId);
    const kind: EntryKind | null = body.kind === 'expense' || body.kind === 'income' ? body.kind : null;
    const amount =
      typeof body.amount === 'number' ? body.amount : extractAmount(normalize(String(body.amount ?? '')))?.amount ?? null;
    const account = byName(ctx.accounts, body.account ?? body.account_id);
    const category = byName(
      ctx.categories.filter((c) => !kind || c.type === 'both' || c.type === kind),
      body.category ?? body.category_id
    );
    if (body.account && !account) throw AppError.badRequest(`No encontré la cuenta "${body.account}"`);

    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : ctx.today;
    const draft: Draft = {
      kind,
      amount,
      account_id: account?.id ?? null,
      category_id: category?.id ?? null,
      subcategory_id: null,
      description: typeof body.description === 'string' ? body.description.trim().slice(0, 200) : '',
      date,
    };
    return { draft: await quickEntryService.resolve(userId, draft, ctx) };
  }

  /** POST /api/quick/entries — interpreta y registra (o solo interpreta con dry_run). */
  create = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { draft, text } = await this.buildDraft(req);
      const dryRun = req.body?.dry_run === true || req.query.dry_run === 'true';

      if (draft.missing.length) {
        return reply(req, res, 422, missingMessage(draft), { draft, summary: describeDraft(draft) });
      }
      if (dryRun) {
        return reply(req, res, 200, describeDraft(draft), { draft, summary: describeDraft(draft) });
      }

      try {
        const result = await quickEntryService.commit(req.userId!, draft, this.source(req), text);
        reply(req, res, 201, result.message, { id: result.id, kind: result.kind, draft });
      } catch (err) {
        if (err instanceof AppError && err.statusCode < 500) {
          return reply(req, res, err.statusCode, friendlyError(err), { draft });
        }
        throw err;
      }
    } catch (error) {
      next(error);
    }
  };

  /** POST /api/quick/undo */
  undo = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      reply(req, res, 200, await quickEntryService.undoLast(req.userId!));
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/quick/summary */
  summary = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      reply(req, res, 200, await quickEntryService.monthSummary(req.userId!));
    } catch (error) {
      next(error);
    }
  };

  /** GET /api/quick/options — nombres de cuentas y categorías para menús de Atajos. */
  options = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ctx = await quickEntryService.getContext(req.userId!);
      res.json({
        success: true,
        data: {
          accounts: ctx.accounts.map((a) => a.name),
          expense_categories: ctx.categories.filter((c) => c.type !== 'income').map((c) => c.name),
          income_categories: ctx.categories.filter((c) => c.type !== 'expense').map((c) => c.name),
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

export const quickEntryController = new QuickEntryController();
