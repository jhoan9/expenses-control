import { Router } from 'express';
import { expensesController } from './expenses.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import { createExpenseValidator, updateExpenseValidator } from './expenses.validator';

const router = Router();

router.use(authenticate);

router.get('/summary', expensesController.getSummary);
router.get('/by-category', expensesController.getByCategory);
router.get('/', expensesController.getAll);
router.get('/:id', expensesController.getById);
router.post('/', validate(createExpenseValidator), expensesController.create);
router.put('/:id', validate(updateExpenseValidator), expensesController.update);
router.delete('/:id', expensesController.delete);

export default router;
