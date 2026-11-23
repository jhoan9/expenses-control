import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon.component';
import {
  AssistantService,
  Conversation,
  Message,
  ProposedAction,
} from '../../../core/services/assistant.service';
import { ToastService } from '../../../core/toast/toast.service';

const SUGGESTIONS = [
  { icon: 'bar-chart', label: 'Informe de mis finanzas de este mes' },
  { icon: 'receipt', label: 'Registra un gasto de 25 mil en almuerzo' },
  { icon: 'calendar', label: 'Arma mi presupuesto de la próxima quincena' },
  { icon: 'tags', label: '¿Mis categorías están bien organizadas?' },
  { icon: 'trending-up', label: 'Analiza la acción de Apple antes de invertir' },
];

const ACTION_TITLES: Record<string, string> = {
  register_transaction: 'Registrar movimiento',
  rename_category: 'Renombrar categoría',
  create_category: 'Crear categoría',
  recategorize_transactions: 'Recategorizar movimientos',
  create_budget: 'Crear presupuesto',
  propose_connector: 'Autorizar API externa',
};

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <button
      class="ai-fab"
      [class.open]="open"
      (click)="toggle()"
      aria-label="Asistente de IA"
    >
      <app-icon [name]="open ? 'x' : 'bot'" />
    </button>

    @if (open) {
      <div class="ai-panel" role="dialog" aria-label="Asistente de IA">
        <div class="ai-header">
          <div class="ai-header-brand">
            <span class="ai-avatar"><app-icon name="bot" /></span>
            <div>
              <h3>Asesor Financiero</h3>
              <span>Consulta, registra, planifica e investiga</span>
            </div>
          </div>
          <button class="ai-icon-btn" (click)="close()" aria-label="Cerrar">
            <app-icon name="x" />
          </button>
        </div>

        @if (view === 'list') {
          <div class="ai-body">
            <button class="ai-new-chat" (click)="newConversation()">
              <app-icon name="sparkles" /> Nueva conversación
            </button>

            @if (loadingConversations) {
              <div class="ai-loading">
                <span class="ai-spinner"></span>
              </div>
            } @else {
              @if (conversations.length === 0) {
                <div class="ai-empty">
                  <span class="ai-empty-icon"><app-icon name="message-circle" /></span>
                  <p>Pregúntame sobre tus finanzas y te ayudaré.</p>
                  <p class="ai-empty-sub">
                    Puedo resumir tu situación, detectar oportunidades de ahorro y
                    proponerte mejoras.
                  </p>
                </div>
              } @else {
                <ul class="ai-conv-list">
                  @for (c of conversations; track c.id) {
                    <li class="ai-conv" (click)="openConversation(c)">
                      <span class="ai-conv-msg"><app-icon name="message-circle" /></span>
                      <div class="ai-conv-info">
                        <strong>{{ c.title }}</strong>
                        @if (c.last_message) {
                          <span>{{ c.last_message }}</span>
                        }
                      </div>
                      <app-icon name="chevron-right" />
                    </li>
                  }
                </ul>
              }
            }
          </div>
        }

        @if (view === 'chat') {
          <div class="ai-chat">
            <div class="ai-chat-head">
              <button
                class="ai-icon-btn"
                (click)="backToList()"
                aria-label="Volver"
              >
                <app-icon name="arrow-left" />
              </button>
              <span class="ai-conv-title">{{ active?.title }}</span>
              <button
                class="ai-icon-btn danger"
                (click)="deleteConversation()"
                aria-label="Eliminar conversación"
              >
                <app-icon name="trash" />
              </button>
            </div>

            @if (confirmDelete) {
              <div class="ai-confirm">
                <span>¿Eliminar esta conversación?</span>
                <button class="ai-confirm-yes" (click)="deleteConversation()">Sí</button>
                <button class="ai-confirm-no" (click)="confirmDelete = false">No</button>
              </div>
            }

            <div class="ai-messages" #scrollFrame>
              @if (loadingMessages) {
                <div class="ai-loading">
                  <span class="ai-spinner"></span>
                </div>
              } @else {
                @if (messages.length === 0) {
                  <div class="ai-empty">
                    <span class="ai-empty-icon"><app-icon name="sparkles" /></span>
                    <p>¡Hola! Soy tu asesor financiero.</p>
                    <p class="ai-empty-sub">
                      Puedo consultar tus movimientos por fechas, hacer informes, registrar gastos,
                      armar presupuestos, ordenar tus categorías y analizar acciones con datos del mercado.
                      Antes de cambiar algo te pido confirmación.
                    </p>
                    <div class="ai-suggestions">
                      @for (s of suggestions; track s.label) {
                        <button class="ai-chip" (click)="startPrompt(s.label)">
                          <app-icon [name]="iconName(s.icon)" /> {{ s.label }}
                        </button>
                      }
                    </div>
                  </div>
                } @else {
                  @for (m of messages; track m.id) {
                    <div class="ai-msg" [class.ai-msg-user]="m.role === 'user'">
                      @if (m.role !== 'user') {
                        <span class="ai-msg-avatar"><app-icon name="bot" /></span>
                      }
                      <div class="ai-msg-body">
                        @if (toolLabels(m).length) {
                          <div class="ai-tools" aria-label="Herramientas usadas">
                            @for (t of toolLabels(m); track t.label) {
                              <span class="ai-tool" [class.failed]="!t.ok">
                                <app-icon [name]="t.ok ? 'check' : 'alert-circle'" /> {{ t.label }}
                              </span>
                            }
                          </div>
                        }
                        <div
                          class="ai-bubble"
                          [innerHTML]="formatContent(m.content)"
                        ></div>
                        @for (a of m.actions ?? []; track a.id) {
                          <div class="ai-action" [attr.data-status]="a.status">
                            <div class="ai-action-head">
                              <app-icon [name]="actionIcon(a)" />
                              <span>{{ actionTitle(a) }}</span>
                            </div>
                            <p class="ai-action-summary">{{ a.summary }}</p>
                            @if (a.status === 'pending') {
                              <div class="ai-action-buttons">
                                <button class="ai-action-confirm" [disabled]="resolving === a.id" (click)="resolve(a, 'confirm')">
                                  {{ resolving === a.id ? 'Aplicando…' : 'Confirmar' }}
                                </button>
                                <button class="ai-action-cancel" [disabled]="resolving === a.id" (click)="resolve(a, 'cancel')">
                                  Cancelar
                                </button>
                              </div>
                            } @else if (a.result) {
                              <p class="ai-action-result">{{ a.result }}</p>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  }
                }

                @if (sending) {
                  <div class="ai-msg">
                    <span class="ai-msg-avatar"><app-icon name="bot" /></span>
                    <div class="ai-bubble ai-typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                }
              }
            </div>

            <div class="ai-input">
              <textarea
                rows="1"
                [(ngModel)]="input"
                (keydown.enter)="onKeydown($event)"
                (input)="autoGrow($event)"
                placeholder="Pregunta o pide algo…"
                [disabled]="sending"
              ></textarea>
              <button
                class="ai-send"
                [disabled]="!input.trim() || sending"
                (click)="send()"
                aria-label="Enviar"
              >
                <app-icon name="send" />
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class AssistantComponent {
  @ViewChild('scrollFrame') scrollFrame!: ElementRef<HTMLElement>;

  suggestions = SUGGESTIONS;

  open = false;
  view: 'list' | 'chat' = 'list';
  conversations: Conversation[] = [];
  active: Conversation | null = null;
  messages: Message[] = [];
  input = '';
  sending = false;
  resolving: number | null = null;
  loadingConversations = false;
  loadingMessages = false;
  confirmDelete = false;

  constructor(
    private assistantService: AssistantService,
    private toast: ToastService
  ) {}

  toggle(): void {
    if (this.open) {
      this.close();
    } else {
      this.openPanel();
    }
  }

  openPanel(): void {
    this.open = true;
    this.view = 'list';
    this.loadConversations();
  }

  close(): void {
    this.open = false;
    this.active = null;
    this.messages = [];
    this.view = 'list';
    this.confirmDelete = false;
  }

  loadConversations(): void {
    this.loadingConversations = true;
    this.assistantService.listConversations().subscribe({
      next: (data) => {
        this.conversations = data;
        this.loadingConversations = false;
      },
      error: () => {
        this.loadingConversations = false;
      },
    });
  }

  newConversation(): void {
    this.assistantService.createConversation().subscribe({
      next: (conv) => {
        this.active = conv;
        this.messages = [];
        this.view = 'chat';
        this.confirmDelete = false;
      },
    });
  }

  openConversation(conv: Conversation): void {
    this.active = conv;
    this.view = 'chat';
    this.loadingMessages = true;
    this.assistantService.getMessages(conv.id).subscribe({
      next: (data) => {
        this.messages = data;
        this.loadingMessages = false;
        setTimeout(() => this.scrollToBottom(), 0);
      },
      error: () => {
        this.loadingMessages = false;
      },
    });
  }

  backToList(): void {
    this.view = 'list';
    this.active = null;
    this.messages = [];
    this.confirmDelete = false;
    this.loadConversations();
  }

  deleteConversation(): void {
    if (!this.active) return;
    if (!this.confirmDelete) {
      this.confirmDelete = true;
      return;
    }
    const id = this.active.id;
    this.assistantService.deleteConversation(id).subscribe({
      next: () => {
        this.toast.showSuccess('Conversación eliminada');
        this.backToList();
      },
      error: () => {
        this.confirmDelete = false;
      },
    });
  }

  startPrompt(text: string): void {
    if (this.sending) return;
    this.input = text;
    this.send();
  }

  send(): void {
    const text = this.input.trim();
    if (!text || this.sending || !this.active) return;
    this.input = '';
    this.sending = true;
    this.confirmDelete = false;

    const optimistic: Message = {
      id: Date.now(),
      conversation_id: this.active.id,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    this.messages.push(optimistic);
    setTimeout(() => this.scrollToBottom(), 0);

    this.assistantService.sendMessage(this.active.id, text).subscribe({
      next: (result) => {
        this.messages.push(result.reply);
        this.sending = false;
        this.active!.title =
          this.active!.title === 'Nueva conversación'
            ? result.userMessage.content.slice(0, 60)
            : this.active!.title;
        setTimeout(() => this.scrollToBottom(), 0);
      },
      error: () => {
        this.sending = false;
      },
    });
  }

  onKeydown(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.shiftKey || keyboardEvent.key !== 'Enter') return;
    keyboardEvent.preventDefault();
    this.send();
  }

  autoGrow(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  scrollToBottom(): void {
    if (this.scrollFrame) {
      this.scrollFrame.nativeElement.scrollTop =
        this.scrollFrame.nativeElement.scrollHeight;
    }
  }

  toolLabels(m: Message): { label: string; ok: boolean }[] {
    const seen = new Map<string, boolean>();
    for (const t of m.meta?.tools ?? []) seen.set(t.label, (seen.get(t.label) ?? true) && t.ok);
    return [...seen.entries()].map(([label, ok]) => ({ label, ok }));
  }

  actionTitle(a: ProposedAction): string {
    const base = ACTION_TITLES[a.tool] ?? 'Acción propuesta';
    const status: Record<string, string> = {
      pending: '',
      confirmed: ' · hecho',
      cancelled: ' · cancelado',
      failed: ' · no se pudo',
      expired: ' · vencido',
    };
    return base + (status[a.status] ?? '');
  }

  actionIcon(a: ProposedAction): string {
    if (a.status === 'confirmed') return 'check';
    if (a.status === 'failed' || a.status === 'expired') return 'alert-circle';
    if (a.status === 'cancelled') return 'x';
    return 'sparkles';
  }

  resolve(a: ProposedAction, decision: 'confirm' | 'cancel'): void {
    if (this.resolving) return;
    this.resolving = a.id;
    this.assistantService.resolveAction(a.id, decision).subscribe({
      next: (r) => {
        Object.assign(a, r.action);
        this.messages.push(r.message);
        this.resolving = null;
        setTimeout(() => this.scrollToBottom(), 0);
      },
      error: () => {
        this.resolving = null;
        // Puede haber vencido o resuelto en otra pestaña: recarga el estado real
        if (this.active) this.openConversation(this.active);
      },
    });
  }

  formatContent(text: string): string {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Tablas Markdown: bloques de líneas que empiezan y terminan con "|"
    const lines = escaped.split('\n');
    const out: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const isRow = (l: string | undefined) => !!l && /^\s*\|.*\|\s*$/.test(l);
      if (isRow(lines[i]) && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
        const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
        const head = cells(lines[i]);
        let j = i + 2;
        const body: string[][] = [];
        while (isRow(lines[j])) body.push(cells(lines[j++]));
        const num = (c: string) => /^[-+−]?\$?\s?[\d.,]+%?$/.test(c);
        out.push(
          '@@TABLE@@<div class="ai-table-wrap"><table class="ai-table"><thead><tr>' +
            head.map((h) => `<th>${h}</th>`).join('') +
            '</tr></thead><tbody>' +
            body.map((r) => '<tr>' + r.map((c) => `<td${num(c) ? ' class="num"' : ''}>${c}</td>`).join('') + '</tr>').join('') +
            '</tbody></table></div>'
        );
        i = j - 1;
      } else {
        out.push(lines[i]);
      }
    }

    const html = out
      .map((line) => {
        if (line.startsWith('@@TABLE@@')) return line.slice(9);
        const t = line.trim();
        if (!t) return '<div class="ai-gap"></div>';
        if (/^#{1,3}\s+(.+)$/.test(t))
          return `<div class="ai-h">${t.replace(/^#{1,3}\s+/, '')}</div>`;
        if (/^[-*]\s+(.+)$/.test(t))
          return `<div class="ai-li">${t.replace(/^[-*]\s+/, '')}</div>`;
        if (/^\d+[.)]\s+(.+)$/.test(t))
          return `<div class="ai-li">${t.replace(/^\d+[.)]\s+/, '')}</div>`;
        return `<div>${t}</div>`;
      })
      .join('');

    return html
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }

  iconName(icon: string): string {
    return icon;
  }
}