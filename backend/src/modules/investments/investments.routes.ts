import { Router } from 'express';
import { investmentsController } from './investments.controller';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  createInvestmentValidator,
  updateInvestmentValidator,
  createPositionValidator,
  createAbonoValidator,
} from './investments.validator';

const router = Router();

router.use(authenticate, authorize('jh01', 'admin'));

router.get('/positions/closed', investmentsController.getClosedPositions);
router.get('/positions', investmentsController.getOpenPositions);
router.get('/', investmentsController.getAll);
router.get('/:id', investmentsController.getById);
router.get('/:id/operations', investmentsController.getOperations);
router.post('/', validate(createInvestmentValidator), investmentsController.create);
router.put('/:id', validate(updateInvestmentValidator), investmentsController.update);
router.delete('/:id', investmentsController.delete);

router.post('/:id/buy', validate(createPositionValidator), investmentsController.buy);
router.post('/:id/sell', validate(createPositionValidator), investmentsController.sell);
router.post('/:id/abonos', validate(createAbonoValidator), investmentsController.createAbono);
router.delete('/:id/abonos/:abonoId', investmentsController.deleteAbono);

export default router;
