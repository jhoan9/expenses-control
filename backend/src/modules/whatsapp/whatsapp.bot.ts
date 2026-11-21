import { queryOne, execute } from '../../config/database';
import { normalize, parseEntry, Draft } from '../quick-entry/parser';
import {
  describeDraft,
  friendlyError,
  quickEntryService,
  ResolvedDraft,
} from '../quick-entry/quick-entry.service';
import { whatsappClient } from './whatsapp.client';
import { whatsappLinkService } from './whatsapp-link.service';

/** Mensaje entrante ya simplificado desde el payload del webhook. */
export interface IncomingMessage {
  id: string;
  from: string;
  type: string;
  text?: string;
  buttonId?: string;
}

const PENDING_TTL_MINUTES = 30;

const YES = new Set(['si', 'sí', 's', 'ok', 'okay', 'dale', 'listo', 'confirmar', 'confirmo', 'registrar', 'guardar', 'va', 'de una', '👍', '✅']);
const NO = new Set(['no', 'n', 'cancelar', 'cancela', 'nada', 'olvidalo', 'borrar', '❌']);

const HELP = [
  'Escríbeme tus movimientos como se lo dirías a alguien:',
  '• gasté 45 mil en mercado con Nequi',
  '• uber 18.500 ayer',
  '• me pagaron 1,2 millones de salario',
  '',
  'Antes de guardar te pido confirmación.',
  'Otros comandos: *resumen* (totales del mes), *deshacer* (borra el último registro), *ayuda*.',
].join('\n');

const MISSING_QUESTION: Record<string, string> = {
  kind: '¿Es un *gasto* o un *ingreso*?',
  amount: '¿De cuánto fue? (por ejemplo: 45 mil)',
  account: '¿Con qué cuenta?',
};

export class WhatsappBot {
  private async getPending(phone: string): Promise<{ draft: ResolvedDraft; original_text: string | null } | null> {
    return queryOne(
      `SELECT draft, original_text FROM whatsapp_pending
        WHERE phone = $1 AND created_at > NOW() - INTERVAL '${PENDING_TTL_MINUTES} minutes'`,
      [phone]
    );
  }

  private async savePending(phone: string, userId: number, draft: ResolvedDraft, text: string | null) {
    await execute(
      `INSERT INTO whatsapp_pending (phone, user_id, draft, original_text, created_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (phone) DO UPDATE SET user_id = EXCLUDED.user_id, draft = EXCLUDED.draft,
         original_text = EXCLUDED.original_text, created_at = CURRENT_TIMESTAMP`,
      [phone, userId, JSON.stringify(draft), text]
    );
  }

  private clearPending(phone: string) {
    return execute('DELETE FROM whatsapp_pending WHERE phone = $1', [phone]);
  }

  /** Marca el mensaje como procesado. false si ya se había procesado (reintento de Meta). */
  private async firstTime(messageId: string): Promise<boolean> {
    const res = await execute(
      'INSERT INTO whatsapp_processed_messages (message_id) VALUES ($1) ON CONFLICT DO NOTHING',
      [messageId]
    );
    return res.rowCount > 0;
  }

  async handle(msg: IncomingMessage): Promise<void> {
    if (!(await this.firstTime(msg.id))) return;

    const phone = msg.from;
    const raw = (msg.text ?? '').trim();
    const t = normalize(raw);
    const user = await whatsappLinkService.userForPhone(phone);

    // ---- Número sin vincular: solo aceptamos el código
    if (!user) {
      const code = /\b(\d{6})\b/.exec(t)?.[1];
      if (!code) {
        await whatsappClient.sendText(
          phone,
          'Hola 👋 Este número aún no está conectado a Controla.\n\n' +
            'Entra a la web → *Integraciones* → *Conectar WhatsApp* y envíame el código de 6 dígitos que aparece allí.'
        );
        return;
      }
      try {
        const linked = await whatsappLinkService.consumeCode(phone, code);
        const first = linked.name.split(/\s+/)[0];
        await whatsappClient.sendText(phone, `¡Listo, ${first}! Tu WhatsApp quedó conectado a Controla ✅\n\n${HELP}`);
      } catch (err) {
        await whatsappClient.sendText(phone, friendlyError(err));
      }
      return;
    }

    if (msg.type !== 'text' && msg.type !== 'interactive' && msg.type !== 'button') {
      await whatsappClient.sendText(phone, 'Por ahora solo entiendo mensajes de texto. Escribe, por ejemplo: "gasté 20 mil en almuerzo".');
      return;
    }

    // ---- Comandos
    if (['ayuda', 'help', 'menu', 'hola', 'buenas', '?', 'inicio'].includes(t)) {
      await whatsappClient.sendText(phone, HELP);
      return;
    }
    if (/^(deshacer|borrar ultimo|eliminar ultimo|me equivoque)$/.test(t)) {
      await this.clearPending(phone);
      await whatsappClient.sendText(phone, await quickEntryService.undoLast(user.id));
      return;
    }
    if (/^(resumen|balance|cuanto llevo( gastado)?|como voy|saldo|mes)\??$/.test(t)) {
      await whatsappClient.sendText(phone, await quickEntryService.monthSummary(user.id));
      return;
    }

    const pending = await this.getPending(phone);

    // ---- Confirmar / cancelar un borrador
    if (pending && (msg.buttonId === 'confirm' || YES.has(t))) {
      await this.clearPending(phone);
      if (pending.draft.missing.length) {
        await this.ask(phone, user.id, pending.draft, pending.original_text);
        return;
      }
      try {
        const result = await quickEntryService.commit(user.id, pending.draft, 'whatsapp', pending.original_text ?? undefined);
        await whatsappClient.sendText(phone, `✅ ${result.message}\n\nSi fue un error, escribe *deshacer*.`);
      } catch (err) {
        await whatsappClient.sendText(phone, `No lo pude registrar: ${friendlyError(err)}`);
      }
      return;
    }
    if (pending && (msg.buttonId === 'cancel' || NO.has(t))) {
      await this.clearPending(phone);
      await whatsappClient.sendText(phone, 'Cancelado, no registré nada.');
      return;
    }
    if (!pending && (YES.has(t) || NO.has(t) || msg.buttonId)) {
      await whatsappClient.sendText(phone, 'No tengo nada pendiente por confirmar. Escríbeme un gasto o ingreso.');
      return;
    }

    if (!raw) return;

    // ---- Completar o corregir el borrador ("con nequi", "gasto", "45 mil").
    // Un mensaje con monto propio sobre un borrador completo es un movimiento nuevo.
    const answerHasAmount = /\d/.test(t) && /\d{2,}|mil|millon|palo|luca|k\b/.test(t);
    if (pending && (pending.draft.missing.length || !answerHasAmount)) {
      const merged = await this.mergeAnswer(user.id, pending.draft, raw);
      if (merged) {
        await this.ask(phone, user.id, merged, pending.original_text);
        return;
      }
    }

    // ---- Nuevo movimiento
    try {
      const draft = await quickEntryService.parse(user.id, raw);
      if (draft.amount == null && !draft.kind) {
        await whatsappClient.sendText(phone, `No entendí ese mensaje 🤔\n\n${HELP}`);
        return;
      }
      await this.ask(phone, user.id, draft, raw);
    } catch (err) {
      await whatsappClient.sendText(phone, friendlyError(err));
    }
  }

  /** Pide el dato faltante o la confirmación, y guarda el borrador. */
  private async ask(phone: string, userId: number, draft: ResolvedDraft, original: string | null) {
    await this.savePending(phone, userId, draft, original);

    if (draft.missing.length) {
      const first = draft.missing[0];
      let question = MISSING_QUESTION[first];
      if (first === 'account') {
        const ctx = await quickEntryService.getContext(userId);
        question += ` Responde con el nombre: ${ctx.accounts.map((a) => a.name).join(', ')}.`;
      }
      await whatsappClient.sendText(phone, `${describeDraft(draft)}\n\n${question}`);
      return;
    }

    const lines = [describeDraft(draft)];
    if (draft.description) lines.push(`“${draft.description}”`);
    if (draft.account_defaulted) lines.push('(usé tu cuenta habitual; escribe otra cuenta si no es esa)');
    await whatsappClient.sendButtons(phone, `${lines.join('\n')}\n\n¿Lo registro?`, [
      { id: 'confirm', title: '✅ Registrar' },
      { id: 'cancel', title: '❌ Cancelar' },
    ]);
  }

  /** Usa una respuesta corta para llenar lo que falta (o corregir la cuenta). */
  private async mergeAnswer(userId: number, draft: ResolvedDraft, answer: string): Promise<ResolvedDraft | null> {
    const ctx = await quickEntryService.getContext(userId);
    const t = normalize(answer);
    const partial: Draft = parseEntry(answer, ctx);

    const kind = /^(gasto|egreso|salida)$/.test(t) ? 'expense' : /^(ingreso|entrada)$/.test(t) ? 'income' : partial.kind;
    const next: Draft = {
      kind: draft.kind ?? kind,
      amount: draft.amount ?? partial.amount,
      account_id: partial.account_id ?? draft.account_id,
      category_id: draft.category_id ?? partial.category_id,
      subcategory_id: draft.category_id != null ? draft.subcategory_id : partial.subcategory_id,
      description: draft.description,
      date: draft.date,
    };
    // Nombrar la misma cuenta que se había supuesto también cuenta como respuesta
    const confirmsAccount = partial.account_id != null && draft.account_defaulted;
    const changed =
      confirmsAccount ||
      next.kind !== draft.kind || next.amount !== draft.amount || next.account_id !== draft.account_id;
    if (!changed) return null;
    // Si nombró otra cuenta, deja de ser la "predeterminada"
    const resolved = await quickEntryService.resolve(userId, next, ctx, draft.used_ai);
    if (partial.account_id) resolved.account_defaulted = false;
    return resolved;
  }
}

export const whatsappBot = new WhatsappBot();

/** Extrae los mensajes de un payload de webhook de WhatsApp Cloud API. */
export const extractMessages = (body: any): IncomingMessage[] => {
  const out: IncomingMessage[] = [];
  if (body?.object !== 'whatsapp_business_account') return out;
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      for (const m of change.value?.messages ?? []) {
        if (!m?.id || !m?.from) continue;
        out.push({
          id: String(m.id),
          from: String(m.from).replace(/\D/g, ''),
          type: String(m.type),
          text: m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title,
          buttonId: m.interactive?.button_reply?.id ?? m.button?.payload,
        });
      }
    }
  }
  return out;
};
