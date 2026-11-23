import { query, queryOne, execute } from '../../../config/database';
import { AppError } from '../../../shared/errors/AppError';
import { ProposedAction, WriteTool } from './types';

const ACTION_TTL_HOURS = 24;

/** Acciones que el asistente propone y el usuario confirma o cancela. */
export class AgentActionsService {
  constructor(private readonly resolveTool: (name: string) => WriteTool | undefined) {}

  async create(
    userId: number,
    conversationId: number,
    tool: string,
    args: Record<string, unknown>,
    summary: string
  ): Promise<ProposedAction> {
    const row = await queryOne<ProposedAction>(
      `INSERT INTO ai_pending_actions (user_id, conversation_id, tool, args, summary)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, tool, summary, status, result`,
      [userId, conversationId, tool, JSON.stringify(args), summary]
    );
    return row!;
  }

  async attachToMessage(ids: number[], messageId: number): Promise<void> {
    if (!ids.length) return;
    await execute('UPDATE ai_pending_actions SET message_id = $1 WHERE id = ANY($2::int[])', [messageId, ids]);
  }

  async listForConversation(userId: number, conversationId: number): Promise<(ProposedAction & { message_id: number | null })[]> {
    await execute(
      `UPDATE ai_pending_actions SET status = 'expired', resolved_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND status = 'pending' AND created_at < NOW() - INTERVAL '${ACTION_TTL_HOURS} hours'`,
      [userId]
    );
    return query(
      `SELECT id, tool, summary, status, result, message_id FROM ai_pending_actions
        WHERE user_id = $1 AND conversation_id = $2 ORDER BY id`,
      [userId, conversationId]
    );
  }

  /** Confirma o cancela. Al confirmar ejecuta la herramienta y guarda el resultado. */
  async resolve(
    userId: number,
    actionId: number,
    decision: 'confirm' | 'cancel'
  ): Promise<ProposedAction & { conversation_id: number }> {
    // Reclama la acción de forma atómica para que no se ejecute dos veces
    const claimed = await queryOne<{ id: number; tool: string; args: any; summary: string; conversation_id: number }>(
      `UPDATE ai_pending_actions
          SET status = $3, resolved_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND status = 'pending'
          AND created_at >= NOW() - INTERVAL '${ACTION_TTL_HOURS} hours'
        RETURNING id, tool, args, summary, conversation_id`,
      [actionId, userId, decision === 'confirm' ? 'confirmed' : 'cancelled']
    );
    if (!claimed) {
      const existing = await queryOne<{ status: string }>(
        'SELECT status FROM ai_pending_actions WHERE id = $1 AND user_id = $2',
        [actionId, userId]
      );
      if (!existing) throw AppError.notFound('Acción no encontrada');
      throw AppError.conflict(
        existing.status === 'pending' ? 'La acción venció; pídesela de nuevo al asistente.' : 'Esta acción ya fue resuelta.'
      );
    }

    if (decision === 'cancel') {
      const result = 'Cancelado. No se hizo ningún cambio.';
      await execute('UPDATE ai_pending_actions SET result = $2 WHERE id = $1', [actionId, result]);
      return { id: claimed.id, tool: claimed.tool, summary: claimed.summary, status: 'cancelled', result, conversation_id: claimed.conversation_id };
    }

    const tool = this.resolveTool(claimed.tool);
    let status: ProposedAction['status'] = 'confirmed';
    let result: string;
    try {
      if (!tool) throw new AppError('Esta acción ya no está disponible.', 400);
      result = await tool.execute({ userId, conversationId: claimed.conversation_id }, claimed.args);
    } catch (err) {
      status = 'failed';
      result =
        err instanceof AppError && err.statusCode < 500
          ? err.message
          : 'No se pudo completar la acción. Intenta de nuevo.';
      if (!(err instanceof AppError)) console.error('[ai] Error ejecutando acción', claimed.tool, (err as Error).message);
    }
    await execute('UPDATE ai_pending_actions SET status = $2, result = $3 WHERE id = $1', [actionId, status, result]);
    return { id: claimed.id, tool: claimed.tool, summary: claimed.summary, status, result, conversation_id: claimed.conversation_id };
  }
}
