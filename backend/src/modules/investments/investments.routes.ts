import { Router } from 'express';
import { investmentsController } from './investments.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  createInvestmentValidator,
  updateInvestmentValidator,
  createPositionValidator,
} from './investments.validator';

const router = Router();

router.use(authenticate);

router.get('/positions', investmentsController.getOpenPositions);
router.get('/', investmentsController.getAll);
router.get('/:id', investmentsController.getById);
router.post('/', validate(createInvestmentValidator), investmentsController.create);
router.put('/:id', validate(updateInvestmentValidator), investmentsController.update);
router.delete('/:id', investmentsController.delete);

router.post('/:id/buy', validate(createPositionValidator), investmentsController.buy);
router.post('/:id/sell', validate(createPositionValidator), investmentsController.sell);

export default router;
