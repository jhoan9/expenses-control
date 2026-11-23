import { Router, Response, NextFunction } from 'express';
import { aiController } from './ai.controller';
import { authenticate, AuthRequest } from '../../shared/middleware/auth.middleware';
import { aiService } from './ai.service';
import { connectorsService } from './connectors/connectors.service';
import { agent } from './agent/registry';
import { marketData } from '../market/market.provider';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  createConversationValidator,
  sendMessageValidator,
} from './ai.validator';

const router = Router();

router.use(authenticate);

router.get('/conversations', aiController.listConversations);
router.post(
  '/conversations',
  validate(createConversationValidator),
  aiController.createConversation
);
router.delete('/conversations/:id', aiController.deleteConversation);
router.get('/conversations/:id/messages', aiController.getMessages);
router.post(
  '/conversations/:id/messages',
  validate(sendMessageValidator),
  aiController.sendMessage
);

type Handler = (req: AuthRequest, res: Response) => Promise<unknown>;
const wrap = (fn: Handler) => (req: AuthRequest, res: Response, next: NextFunction) => fn(req, res).catch(next);
const id = (req: AuthRequest) => Number.parseInt(req.params.id, 10);

// ---- Acciones propuestas por el asistente
router.post('/actions/:id/confirm', wrap(async (req, res) => {
  res.json({ success: true, data: await aiService.resolveAction(req.userId!, id(req), 'confirm') });
}));
router.post('/actions/:id/cancel', wrap(async (req, res) => {
  res.json({ success: true, data: await aiService.resolveAction(req.userId!, id(req), 'cancel') });
}));

// ---- Capacidades (para la interfaz)
router.get('/capabilities', wrap(async (_req, res) => {
  res.json({
    success: true,
    data: {
      market_provider: marketData.providerName,
      tools: agent.declarations.map((d) => d.name),
    },
  });
}));

// ---- Conectores de API externas
router.get('/connectors', wrap(async (req, res) => {
  res.json({ success: true, data: await connectorsService.list(req.userId!) });
}));
router.post('/connectors', wrap(async (req, res) => {
  const { secret, ...input } = req.body ?? {};
  res.status(201).json({ success: true, data: await connectorsService.create(req.userId!, input, secret || undefined) });
}));
router.put('/connectors/:id/secret', wrap(async (req, res) => {
  await connectorsService.setSecret(req.userId!, id(req), req.body?.secret ?? null);
  res.json({ success: true });
}));
router.patch('/connectors/:id', wrap(async (req, res) => {
  await connectorsService.setEnabled(req.userId!, id(req), Boolean(req.body?.enabled));
  res.json({ success: true });
}));
router.delete('/connectors/:id', wrap(async (req, res) => {
  await connectorsService.remove(req.userId!, id(req));
  res.json({ success: true });
}));

export default router;