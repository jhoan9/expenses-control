import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  last_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface SendResult {
  reply: Message;
  userMessage: Message;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Injectable({
  providedIn: 'root',
})
export class AssistantService {
  constructor(private api: ApiService) {}

  listConversations(): Observable<Conversation[]> {
    return this.api
      .get<ApiResponse<Conversation[]>>('/ai/conversations')
      .pipe(map((r) => r.data));
  }

  createConversation(title?: string): Observable<Conversation> {
    return this.api
      .post<ApiResponse<Conversation>>('/ai/conversations', { title })
      .pipe(map((r) => r.data));
  }

  deleteConversation(id: number): Observable<unknown> {
    return this.api.delete(`/ai/conversations/${id}`);
  }

  getMessages(conversationId: number): Observable<Message[]> {
    return this.api
      .get<ApiResponse<Message[]>>(`/ai/conversations/${conversationId}/messages`)
      .pipe(map((r) => r.data));
  }

  sendMessage(conversationId: number, content: string): Observable<SendResult> {
    return this.api
      .post<ApiResponse<SendResult>>(`/ai/conversations/${conversationId}/messages`, {
        content,
      })
      .pipe(map((r) => r.data));
  }
}