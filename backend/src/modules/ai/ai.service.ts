import { query, queryOne, execute } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { GeminiContent } from './llm.client';
import { buildFinancialContext, buildSystemPrompt } from './financial-context';
import { agent } from './agent/registry';
import { ProposedAction, ToolTrace } from './agent/types';
import { localToday } from '../quick-entry/quick-entry.service';

const DEFAULT_TITLE = 'Nueva conversación';
const HISTORY_LIMIT = 20;

export interface AiConversation {
  id: number;
  user_id: number;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface AiMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: Date;
  meta?: { tools?: ToolTrace[]; action_result?: number } | null;
  actions?: ProposedAction[];
}

const mapRole = (role: string): 'user' | 'model' =>
  role === 'assistant' ? 'model' : 'user';

const MESSAGE_COLUMNS = 'id, conversation_id, role, content, meta, created_at';

export class AiService {
  async listConversations(userId: number): Promise<AiConversation[]> {
    return query<AiConversation>(
      `SELECT c.*, 
              (SELECT content FROM ai_messages m 
               WHERE m.conversation_id = c.id AND m.role = 'user' 
               ORDER BY m.id DESC LIMIT 1) AS last_message
       FROM ai_conversations c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC`,
      [userId]
    );
  }

  async getConversation(userId: number, conversationId: number): Promise<AiConversation> {
    const conv = await queryOne<AiConversation>(
      'SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    if (!conv) {
      throw AppError.notFound('Conversación no encontrada');
    }
    return conv;
  }

  async createConversation(userId: number, title?: string): Promise<AiConversation> {
    const conv = await queryOne<AiConversation>(
      `INSERT INTO ai_conversations (user_id, title)
       VALUES ($1, $2)
       RETURNING *`,
      [userId, (title || DEFAULT_TITLE).trim().slice(0, 200)]
    );
    return conv!;
  }

  async deleteConversation(userId: number, conversationId: number): Promise<void> {
    const result = await execute(
      'DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    if (result.rowCount === 0) {
      throw AppError.notFound('Conversación no encontrada');
    }
  }

  async getMessages(userId: number, conversationId: number): Promise<AiMessage[]> {
    await this.getConversation(userId, conversationId);
    const [messages, actions] = await Promise.all([
      query<AiMessage>(
        `SELECT ${MESSAGE_COLUMNS} FROM ai_messages WHERE conversation_id = $1 ORDER BY id ASC`,
        [conversationId]
      ),
      agent.actions.listForConversation(userId, conversationId),
    ]);
    for (const m of messages) {
      m.actions = actions.filter((a) => a.message_id === m.id).map(({ message_id, ...a }) => a);
    }
    return messages;
  }

  async sendMessage(
    userId: number,
    conversationId: number,
    content: string
  ): Promise<{ reply: AiMessage; userMessage: AiMessage }> {
    const conv = await this.getConversation(userId, conversationId);

    const userMessage = await queryOne<AiMessage>(
      `INSERT INTO ai_messages (conversation_id, role, content)
       VALUES ($1, 'user', $2)
       RETURNING ${MESSAGE_COLUMNS}`,
      [conversationId, content]
    );

    if (conv.title === DEFAULT_TITLE) {
      const titleText = content.replace(/\s+/g, ' ').trim();
      await execute(
        'UPDATE ai_conversations SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [titleText.slice(0, 60), conversationId]
      );
    } else {
      await execute(
        'UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [conversationId]
      );
    }

    const history = await query<AiMessage>(
      `SELECT ${MESSAGE_COLUMNS}
       FROM ai_messages
       WHERE conversation_id = $1
       ORDER BY id DESC
       LIMIT ${HISTORY_LIMIT}`,
      [conversationId]
    );

    const [context, userName] = await Promise.all([
      buildFinancialContext(userId),
      queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [userId]),
    ]);

    const system = buildSystemPrompt(context, userName?.name || 'usuario', localToday());

    // Historial como turnos alternos; los mensajes consecutivos del mismo rol se unen
    const contents: GeminiContent[] = [];
    for (const m of history.reverse()) {
      const role = mapRole(m.role);
      const prev = contents[contents.length - 1];
      if (prev && prev.role === role) prev.parts.push({ text: `\n\n${m.content}` });
      else contents.push({ role, parts: [{ text: m.content }] });
    }
    if (contents[0]?.role === 'model') contents.shift();

    const result = await agent.run({ userId, conversationId }, system, contents);
    const replyText =
      result.text ||
      (result.actions.length ? 'Revisa la propuesta y confírmala en la tarjeta de abajo.' : 'No tengo una respuesta para eso.');

    const reply = await queryOne<AiMessage>(
      `INSERT INTO ai_messages (conversation_id, role, content, meta)
       VALUES ($1, 'assistant', $2, $3)
       RETURNING ${MESSAGE_COLUMNS}`,
      [conversationId, replyText, JSON.stringify({ tools: result.tools })]
    );
    await agent.actions.attachToMessage(result.actions.map((a) => a.id), reply!.id);
    reply!.actions = result.actions;

    return { reply: reply!, userMessage: userMessage! };
  }

  /** Confirma o cancela una acción propuesta y deja el resultado como mensaje en el chat. */
  async resolveAction(
    userId: number,
    actionId: number,
    decision: 'confirm' | 'cancel'
  ): Promise<{ action: ProposedAction; message: AiMessage }> {
    const action = await agent.actions.resolve(userId, actionId, decision);
    const icon = action.status === 'confirmed' ? '✅' : action.status === 'failed' ? '⚠️' : '↩️';
    const message = await queryOne<AiMessage>(
      `INSERT INTO ai_messages (conversation_id, role, content, meta)
       VALUES ($1, 'assistant', $2, $3)
       RETURNING ${MESSAGE_COLUMNS}`,
      [action.conversation_id, `${icon} ${action.result}`, JSON.stringify({ action_result: action.id })]
    );
    await execute('UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [action.conversation_id]);
    const { conversation_id, ...rest } = action;
    return { action: rest, message: message! };
  }
}

export const aiService = new AiService();