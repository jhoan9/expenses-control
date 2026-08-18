import { Router } from 'express';
import { creditsController } from './credits.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  createCreditValidator,
  updateCreditValidator,
  createPaymentValidator,
} from './credits.validator';

const router = Router();

router.use(authenticate);

router.get('/summary', creditsController.getSummary);
router.get('/', creditsController.getAll);
router.get('/:id', creditsController.getById);
router.post('/', validate(createCreditValidator), creditsController.create);
router.put('/:id', validate(updateCreditValidator), creditsController.update);
router.delete('/:id', creditsController.delete);

router.post('/:id/payments', validate(createPaymentValidator), creditsController.addPayment);
router.delete('/:id/payments/:paymentId', creditsController.deletePayment);

export default router;
