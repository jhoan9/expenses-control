import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../core/toast/toast.service';
import { IconComponent } from '../../shared/components/icon/icon.component';

interface WhatsappStatus {
  enabled: boolean;
  linked: boolean;
  phone: string | null;
  linked_at: string | null;
  bot_number: string | null;
}

interface ApiToken {
  id: number;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

interface Account {
  id: number;
  name: string;
  type: string;
}

type Tab = 'whatsapp' | 'shortcuts';

@Component({
  selector: 'app-integrations',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div class="page integrations">
      <div class="page-header">
        <div>
          <h1 class="page-title">Integraciones</h1>
          <p class="page-subtitle">
            Registra gastos e ingresos sin abrir la web: escribiéndole a un chat de WhatsApp o con un atajo en tu celular.
          </p>
        </div>
      </div>

      <div class="filter-tabs" role="tablist">
        <button role="tab" [class.active]="tab === 'whatsapp'" [attr.aria-selected]="tab === 'whatsapp'" (click)="tab = 'whatsapp'">
          WhatsApp
        </button>
        <button role="tab" [class.active]="tab === 'shortcuts'" [attr.aria-selected]="tab === 'shortcuts'" (click)="tab = 'shortcuts'">
          Atajos de iPhone y Android
        </button>
      </div>

      <div class="integrations-grid">
        <!-- ================= WhatsApp ================= -->
        <section class="int-card" *ngIf="tab === 'whatsapp'">
          <header class="int-card-head">
            <span class="int-icon whatsapp"><app-icon name="message-circle" /></span>
            <div>
              <h2>WhatsApp</h2>
              <p>Escribe "gasté 45 mil en mercado con Nequi" y el bot lo registra después de que confirmes.</p>
            </div>
            <span class="status-badge" [class.status-active]="wa?.linked" [class.status-closed]="!wa?.linked">
              {{ wa?.linked ? 'Conectado' : 'Sin conectar' }}
            </span>
          </header>

          <div class="int-body" *ngIf="wa">
            <div class="notice" *ngIf="!wa.enabled">
              <app-icon name="alert-circle" />
              <span>El bot de WhatsApp todavía no está configurado en el servidor. Cuando se configure, podrás conectar tu número aquí.</span>
            </div>

            <ng-container *ngIf="wa.enabled && wa.linked">
              <dl class="kv">
                <div><dt>Número</dt><dd>{{ wa.phone }}</dd></div>
                <div><dt>Conectado desde</dt><dd>{{ wa.linked_at | date: 'd MMM y' }}</dd></div>
              </dl>
              <div class="int-actions">
                <a class="btn-secondary" *ngIf="wa.bot_number" [href]="'https://wa.me/' + wa.bot_number" target="_blank" rel="noopener">
                  <app-icon name="external-link" /> Abrir chat
                </a>
                <button class="btn-ghost danger-text" (click)="unlinkWhatsapp()">Desconectar</button>
              </div>
            </ng-container>

            <ng-container *ngIf="wa.enabled && !wa.linked">
              <ol class="steps">
                <li>Genera un código de conexión (vence en 10 minutos).</li>
                <li>Envíaselo al número de Controla desde tu WhatsApp.</li>
                <li>Listo: desde ese chat ya puedes registrar movimientos.</li>
              </ol>

              <div class="code-box" *ngIf="code">
                <span class="code" aria-label="Código de conexión">{{ code | slice: 0 : 3 }} {{ code | slice: 3 }}</span>
                <span class="code-exp">Vence en {{ remaining }}</span>
              </div>

              <div class="int-actions">
                <button class="btn-primary" (click)="generateCode()" [disabled]="busy">
                  {{ code ? 'Generar otro código' : 'Generar código' }}
                </button>
                <a class="btn-secondary" *ngIf="code && wa.bot_number" [href]="waLink" target="_blank" rel="noopener">
                  <app-icon name="external-link" /> Enviar por WhatsApp
                </a>
                <button class="btn-ghost" *ngIf="code" (click)="refreshStatus()">Ya lo envié</button>
              </div>
            </ng-container>

            <div class="examples">
              <span class="examples-title">Lo que entiende el bot</span>
              <ul>
                <li><code>gasté 45 mil en mercado con Nequi</code></li>
                <li><code>uber 18.500 ayer</code></li>
                <li><code>me pagaron 1,2 millones de salario</code></li>
                <li><code>resumen</code> · <code>deshacer</code> · <code>ayuda</code></li>
              </ul>
            </div>
          </div>
        </section>

        <!-- ================= Atajos ================= -->
        <section class="int-card" *ngIf="tab === 'shortcuts'">
          <header class="int-card-head">
            <span class="int-icon"><app-icon name="smartphone" /></span>
            <div>
              <h2>Atajos de iPhone y automatizaciones de Android</h2>
              <p>Crea un token y úsalo en Atajos (iPhone), HTTP Shortcuts o MacroDroid (Android). Con Siri puedes dictar el gasto.</p>
            </div>
          </header>

          <div class="int-body">
            <div class="token-created" *ngIf="newToken">
              <div class="notice warning">
                <app-icon name="key" />
                <span>Copia este token ahora. Por seguridad no se vuelve a mostrar.</span>
              </div>
              <div class="copy-row">
                <code class="secret">{{ newToken }}</code>
                <button class="btn-secondary" (click)="copy(newToken, 'Token copiado')"><app-icon name="copy" /> Copiar</button>
              </div>
            </div>

            <form class="token-form" (ngSubmit)="createToken()">
              <div class="form-group">
                <label for="token-name">Nombre del dispositivo</label>
                <input id="token-name" name="tokenName" [(ngModel)]="tokenName" maxlength="80" placeholder="Ej: iPhone de Laura" />
              </div>
              <button class="btn-primary" type="submit" [disabled]="busy">Crear token</button>
            </form>

            <div class="table-container" *ngIf="tokens.length">
              <table>
                <thead>
                  <tr><th>Dispositivo</th><th>Token</th><th>Último uso</th><th></th></tr>
                </thead>
                <tbody>
                  <tr *ngFor="let t of tokens">
                    <td>{{ t.name }}</td>
                    <td><code>{{ t.token_prefix }}…</code></td>
                    <td>{{ t.last_used_at ? (t.last_used_at | date: 'd MMM, HH:mm') : 'Nunca' }}</td>
                    <td class="actions-cell">
                      <button class="btn-icon" aria-label="Eliminar" title="Revocar" (click)="revokeToken(t)"><app-icon name="trash" /></button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="howto">
              <span class="examples-title">Configuración de la petición</span>
              <dl class="kv">
                <div>
                  <dt>URL</dt>
                  <dd class="copy-row">
                    <code>{{ endpoint }}</code>
                    <button class="btn-icon" aria-label="Copiar URL" (click)="copy(endpoint, 'URL copiada')"><app-icon name="copy" /></button>
                  </dd>
                </div>
                <div><dt>Método</dt><dd><code>POST</code></dd></div>
                <div><dt>Encabezado</dt><dd><code>Authorization: Bearer &lt;tu token&gt;</code></dd></div>
                <div><dt>Cuerpo (JSON)</dt><dd><code>{{ '{' }}"text": "gasté 45 mil en mercado"{{ '}' }}</code></dd></div>
              </dl>
              <p class="hint">
                La respuesta trae un campo <code>message</code> listo para mostrar o para que Siri lo lea.
                Agrega <code>?format=text</code> a la URL para recibir solo el texto.
              </p>
            </div>
          </div>
        </section>

        <!-- ================= Lateral: preferencias + prueba ================= -->
        <aside class="int-side">
          <section class="int-card compact">
            <h3>Cuenta predeterminada</h3>
            <p class="hint">Se usa cuando el mensaje no nombra ninguna cuenta.</p>
            <div class="form-group">
              <label for="def-exp">Para gastos</label>
              <select id="def-exp" [(ngModel)]="settings.default_expense_account_id" (change)="saveSettings()">
                <option [ngValue]="null">La que más uso</option>
                <option *ngFor="let a of accounts" [ngValue]="a.id">{{ a.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label for="def-inc">Para ingresos</label>
              <select id="def-inc" [(ngModel)]="settings.default_income_account_id" (change)="saveSettings()">
                <option [ngValue]="null">La que más uso</option>
                <option *ngFor="let a of accounts" [ngValue]="a.id">{{ a.name }}</option>
              </select>
            </div>
          </section>

          <section class="int-card compact">
            <h3>Probar un mensaje</h3>
            <p class="hint">Así interpretamos lo que escribes, antes de registrar nada.</p>
            <form (ngSubmit)="tryParse()">
              <div class="form-group">
                <label for="try-text">Mensaje</label>
                <input id="try-text" name="tryText" [(ngModel)]="tryText" maxlength="500" placeholder="gasté 45 mil en mercado con Nequi" />
              </div>
              <div class="int-actions">
                <button class="btn-secondary" type="submit" [disabled]="busy || !tryText.trim()">Interpretar</button>
                <button class="btn-primary" type="button" *ngIf="tryResult?.ok" (click)="commitTry()" [disabled]="busy">Registrar</button>
              </div>
            </form>
            <div class="try-result" *ngIf="tryResult" [class.bad]="!tryResult.ok" role="status">
              <app-icon [name]="tryResult.ok ? 'check' : 'alert-circle'" />
              <span>{{ tryResult.message }}</span>
            </div>
          </section>
        </aside>
      </div>
    </div>
  `,
})
export class IntegrationsComponent implements OnInit, OnDestroy {
  tab: Tab = 'whatsapp';
  busy = false;

  wa: WhatsappStatus | null = null;
  code = '';
  expiresAt = 0;
  remaining = '';
  private timer?: ReturnType<typeof setInterval>;

  tokens: ApiToken[] = [];
  tokenName = '';
  newToken = '';

  accounts: Account[] = [];
  settings: { default_expense_account_id: number | null; default_income_account_id: number | null } = {
    default_expense_account_id: null,
    default_income_account_id: null,
  };

  tryText = '';
  tryResult: { ok: boolean; message: string } | null = null;

  constructor(private api: ApiService, private toast: ToastService) {}

  get endpoint(): string {
    return `${this.api.baseUrl}/quick/entries`;
  }

  get waLink(): string {
    return `https://wa.me/${this.wa?.bot_number}?text=${encodeURIComponent(this.code)}`;
  }

  ngOnInit(): void {
    this.refreshStatus();
    this.loadTokens();
    this.api.get<any>('/accounts').subscribe((r) => (this.accounts = r.data ?? []));
    this.api.get<any>('/integrations/settings').subscribe((r) => (this.settings = r.data));
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  refreshStatus(): void {
    this.api.get<any>('/integrations/whatsapp').subscribe((r) => {
      this.wa = r.data;
      if (this.wa?.linked) {
        this.code = '';
        clearInterval(this.timer);
      }
    });
  }

  generateCode(): void {
    this.busy = true;
    this.api.post<any>('/integrations/whatsapp/code').subscribe({
      next: (r) => {
        this.busy = false;
        this.code = r.data.code;
        this.expiresAt = new Date(r.data.expires_at).getTime();
        this.tick();
        clearInterval(this.timer);
        this.timer = setInterval(() => this.tick(), 1000);
      },
      error: () => (this.busy = false),
    });
  }

  private tick(): void {
    const ms = this.expiresAt - Date.now();
    if (ms <= 0) {
      this.code = '';
      this.remaining = '';
      clearInterval(this.timer);
      return;
    }
    const s = Math.ceil(ms / 1000);
    this.remaining = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    // Revisa de vez en cuando si ya se vinculó desde el teléfono
    if (s % 5 === 0) this.refreshStatus();
  }

  unlinkWhatsapp(): void {
    if (!confirm('¿Desconectar tu WhatsApp? Dejarás de poder registrar movimientos desde el chat.')) return;
    this.api.delete<any>('/integrations/whatsapp').subscribe(() => {
      this.toast.showSuccess('WhatsApp desconectado');
      this.refreshStatus();
    });
  }

  loadTokens(): void {
    this.api.get<any>('/integrations/tokens').subscribe((r) => (this.tokens = r.data ?? []));
  }

  createToken(): void {
    this.busy = true;
    this.api.post<any>('/integrations/tokens', { name: this.tokenName }).subscribe({
      next: (r) => {
        this.busy = false;
        this.newToken = r.data.token;
        this.tokenName = '';
        this.loadTokens();
      },
      error: () => (this.busy = false),
    });
  }

  revokeToken(t: ApiToken): void {
    if (!confirm(`¿Revocar el token de "${t.name}"? Las automatizaciones que lo usen dejarán de funcionar.`)) return;
    this.api.delete<any>(`/integrations/tokens/${t.id}`).subscribe(() => {
      this.toast.showSuccess('Token revocado');
      this.loadTokens();
    });
  }

  saveSettings(): void {
    this.api.put<any>('/integrations/settings', this.settings).subscribe(() => this.toast.showSuccess('Preferencia guardada'));
  }

  tryParse(): void {
    this.send(true);
  }

  commitTry(): void {
    this.send(false);
  }

  private send(dryRun: boolean): void {
    if (!this.tryText.trim()) return;
    this.busy = true;
    this.api
      .post<any>('/quick/entries', { text: this.tryText, dry_run: dryRun }, { silentErrors: true })
      .subscribe({
        next: (r) => {
          this.busy = false;
          this.tryResult = { ok: dryRun, message: r.message };
          if (!dryRun) {
            this.toast.showSuccess(r.message);
            this.tryText = '';
            this.tryResult = null;
          }
        },
        error: (e) => {
          this.busy = false;
          this.tryResult = { ok: false, message: e.error?.message || e.error?.error?.message || 'No se pudo interpretar el mensaje' };
        },
      });
  }

  copy(value: string, msg: string): void {
    navigator.clipboard?.writeText(value).then(
      () => this.toast.showSuccess(msg),
      () => this.toast.showError('No se pudo copiar. Selecciona el texto y cópialo manualmente.')
    );
  }
}
