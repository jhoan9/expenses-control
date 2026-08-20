import { Router } from 'express';
import { accountsController } from './accounts.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  createAccountValidator,
  updateAccountValidator,
  transferValidator,
  creditCardPaymentValidator,
} from './accounts.validator';

const router = Router();

router.use(authenticate);

router.get('/', accountsController.getAll);
router.get('/:id', accountsController.getById);
router.post('/', validate(createAccountValidator), accountsController.create);
router.put('/:id', validate(updateAccountValidator), accountsController.update);
router.delete('/:id', accountsController.delete);
router.post('/:id/transfer', validate(transferValidator), accountsController.transfer);
router.post('/:id/abono', validate(creditCardPaymentValidator), accountsController.creditCardPayment);

export default router;
