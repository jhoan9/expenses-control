import { Router } from 'express';
import { loansController } from './loans.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  createLoanValidator,
  updateLoanValidator,
  createPaymentValidator,
} from './loans.validator';

const router = Router();

router.use(authenticate);

router.get('/summary', loansController.getSummary);
router.get('/', loansController.getAll);
router.get('/:id', loansController.getById);
router.post('/', validate(createLoanValidator), loansController.create);
router.put('/:id', validate(updateLoanValidator), loansController.update);
router.delete('/:id', loansController.delete);

router.post('/:id/payments', validate(createPaymentValidator), loansController.addPayment);
router.delete('/:id/payments/:paymentId', loansController.deletePayment);

export default router;
