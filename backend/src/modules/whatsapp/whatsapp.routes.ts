import { Router, Request, Response } from 'express';
import { env } from '../../config/env';
import { extractMessages, whatsappBot } from './whatsapp.bot';
import { verifySignature } from './whatsapp.client';

/**
 * Webhook público de WhatsApp Cloud API.
 *  GET  /api/whatsapp/webhook → verificación inicial de Meta (hub.challenge)
 *  POST /api/whatsapp/webhook → mensajes entrantes (firmados con el App Secret)
 * Se monta antes del limitador general: todos los mensajes llegan desde las IP de Meta.
 */
const router = Router();

router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).type('text/plain').send(String(challenge ?? ''));
    return;
  }
  res.sendStatus(403);
});

router.post('/webhook', (req: Request & { rawBody?: Buffer }, res: Response) => {
  // En producción la firma es obligatoria; en desarrollo se puede probar sin App Secret.
  if (env.WHATSAPP_APP_SECRET || env.isProduction) {
    const ok = verifySignature(req.rawBody, req.header('x-hub-signature-256'), env.WHATSAPP_APP_SECRET);
    if (!ok) {
      res.sendStatus(401);
      return;
    }
  }

  // Meta espera un 200 rápido; procesamos después de responder.
  res.sendStatus(200);

  const messages = extractMessages(req.body);
  (async () => {
    for (const msg of messages) {
      try {
        await whatsappBot.handle(msg);
      } catch (err) {
        console.error('[whatsapp] Error procesando mensaje', msg.id, (err as Error).message);
      }
    }
  })();
});

export default router;
