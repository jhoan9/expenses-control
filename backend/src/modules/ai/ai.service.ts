import { query, queryOne, execute } from '../../config/database';
import { AppError } from '../../shared/errors/AppError';
import { chatCompletion, LLMMessage } from './llm.client';
import { buildFinancialContext, buildSystemPrompt } from './financial-context';

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
}

const mapRole = (role: string): 'user' | 'model' =>
  role === 'assistant' ? 'model' : 'user';

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
    return query<AiMessage>(
      `SELECT id, conversation_id, role, content, created_at
       FROM ai_messages
       WHERE conversation_id = $1
       ORDER BY id ASC`,
      [conversationId]
    );
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
       RETURNING id, conversation_id, role, content, created_at`,
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
      `SELECT id, conversation_id, role, content, created_at
       FROM ai_messages
       WHERE conversation_id = $1
       ORDER BY id DESC
       LIMIT ${HISTORY_LIMIT}`,
      [conversationId]
    );

    const [context, userName] = await Promise.all([
      buildFinancialContext(userId),
      queryOne<{ name: string }>('SELECT name FROM users WHERE id = $1', [
        userId,
      ]),
    ]);

    const system = buildSystemPrompt(
      context,
      userName?.name || 'usuario'
    );

    const llmMessages: LLMMessage[] = history
      .map((m) => ({ role: mapRole(m.role), text: m.content }))
      .reverse();

    const replyText = await chatCompletion(system, llmMessages);

    const reply = await queryOne<AiMessage>(
      `INSERT INTO ai_messages (conversation_id, role, content)
       VALUES ($1, 'assistant', $2)
       RETURNING id, conversation_id, role, content, created_at`,
      [conversationId, replyText]
    );

    return { reply: reply!, userMessage: userMessage! };
  }
}

export const aiService = new AiService();