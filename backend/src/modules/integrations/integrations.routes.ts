import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../shared/middleware/auth.middleware';
import { apiTokensService } from './api-tokens.service';
import { quickEntryService } from '../quick-entry/quick-entry.service';
import { whatsappLinkService } from '../whatsapp/whatsapp-link.service';

/**
 * Gestión de integraciones desde la web (requiere sesión normal, no token):
 * tokens para automatizaciones, cuentas por defecto y vinculación de WhatsApp.
 */
const router = Router();
router.use(authenticate);

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>;
const wrap = (fn: Handler) => (req: AuthRequest, res: Response, next: NextFunction) =>
  fn(req, res).catch(next);

// ---- Tokens personales
router.get('/tokens', wrap(async (req, res) => {
  res.json({ success: true, data: await apiTokensService.list(req.userId!) });
}));

router.post('/tokens', wrap(async (req, res) => {
  const created = await apiTokensService.create(req.userId!, String(req.body?.name ?? ''));
  res.status(201).json({ success: true, data: created });
}));

router.delete('/tokens/:id', wrap(async (req, res) => {
  await apiTokensService.revoke(req.userId!, Number(req.params.id));
  res.json({ success: true });
}));

// ---- Preferencias de registro rápido
router.get('/settings', wrap(async (req, res) => {
  res.json({ success: true, data: await quickEntryService.getSettings(req.userId!) });
}));

router.put('/settings', wrap(async (req, res) => {
  const toId = (v: unknown) => (v === null || v === '' || v === undefined ? null : Number(v));
  const data = await quickEntryService.updateSettings(req.userId!, {
    default_expense_account_id: toId(req.body?.default_expense_account_id),
    default_income_account_id: toId(req.body?.default_income_account_id),
  });
  res.json({ success: true, data });
}));

// ---- WhatsApp
router.get('/whatsapp', wrap(async (req, res) => {
  res.json({ success: true, data: await whatsappLinkService.status(req.userId!) });
}));

router.post('/whatsapp/code', wrap(async (req, res) => {
  res.status(201).json({ success: true, data: await whatsappLinkService.createCode(req.userId!) });
}));

router.delete('/whatsapp', wrap(async (req, res) => {
  await whatsappLinkService.unlink(req.userId!);
  res.json({ success: true });
}));

export default router;
