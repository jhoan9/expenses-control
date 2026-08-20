import { Router } from 'express';
import { budgetController } from './budget.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  createBudgetValidator,
  updateBudgetValidator,
  createBudgetItemValidator,
  updateBudgetItemValidator,
} from './budget.validator';

const router = Router();

router.use(authenticate);

router.get('/', budgetController.getAll);
router.get('/:id', budgetController.getById);
router.get('/:id/summary', budgetController.getSummary);
router.post('/', validate(createBudgetValidator), budgetController.create);
router.put('/:id', validate(updateBudgetValidator), budgetController.update);
router.delete('/:id', budgetController.delete);

router.post('/:id/items', validate(createBudgetItemValidator), budgetController.addItem);
router.put('/:id/items/bulk', budgetController.bulkItems);
router.put('/:id/items/:itemId', validate(updateBudgetItemValidator), budgetController.updateItem);
router.delete('/:id/items/:itemId', budgetController.deleteItem);
router.post('/:id/copy', budgetController.copyNext);

export default router;
