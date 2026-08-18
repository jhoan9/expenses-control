import { Router } from 'express';
import { paymentMethodsController } from './payment-methods.controller';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import { createPaymentMethodValidator, updatePaymentMethodValidator } from './payment-methods.validator';

const router = Router();

router.get('/', paymentMethodsController.getAll);
router.get('/:id', paymentMethodsController.getById);
router.post('/', authenticate, authorize('admin'), validate(createPaymentMethodValidator), paymentMethodsController.create);
router.put('/:id', authenticate, authorize('admin'), validate(updatePaymentMethodValidator), paymentMethodsController.update);
router.delete('/:id', authenticate, authorize('admin'), paymentMethodsController.delete);

export default router;
