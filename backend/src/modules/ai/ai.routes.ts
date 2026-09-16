import { Router } from 'express';
import { aiController } from './ai.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
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

export default router;