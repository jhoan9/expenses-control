import crypto from 'crypto';
import { env } from '../../config/env';

/**
 * Cliente mínimo de WhatsApp Cloud API (Graph API de Meta).
 * https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

export interface ReplyButton {
  id: string;
  /** Máximo 20 caracteres (límite de WhatsApp) */
  title: string;
}

type Transport = (payload: Record<string, unknown>) => Promise<void>;

const graphTransport: Transport = async (payload) => {
  if (env.WHATSAPP_DRY_RUN) {
    console.log('[whatsapp:dry-run] →', JSON.stringify(payload));
    return;
  }
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    console.warn('[whatsapp] Sin credenciales: mensaje no enviado');
    return;
  }
  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[whatsapp] Error ${res.status} al enviar: ${detail.slice(0, 300)}`);
  }
};

export const whatsappClient = {
  /** Se puede reemplazar en pruebas para capturar los mensajes enviados. */
  transport: graphTransport as Transport,

  sendText(to: string, body: string): Promise<void> {
    return this.transport({
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: body.slice(0, 4096) },
    });
  },

  sendButtons(to: string, body: string, buttons: ReplyButton[]): Promise<void> {
    return this.transport({
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body.slice(0, 1024) },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    });
  },
};

/**
 * Verifica la firma X-Hub-Signature-256 que Meta envía con cada webhook
 * (HMAC-SHA256 del cuerpo crudo con el App Secret).
 */
export const verifySignature = (rawBody: Buffer | undefined, header: string | undefined, secret: string): boolean => {
  if (!rawBody || !header || !secret || !header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = header.slice(7);
  if (!/^[0-9a-f]{64}$/i.test(received)) return false;
  return crypto.timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(expected, 'hex'));
};
