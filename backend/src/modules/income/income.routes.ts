import { Router } from 'express';
import { incomeController } from './income.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import { createIncomeValidator, updateIncomeValidator } from './income.validator';

const router = Router();

router.use(authenticate);

router.get('/', incomeController.getAll);
router.get('/:id', incomeController.getById);
router.post('/', validate(createIncomeValidator), incomeController.create);
router.put('/:id', validate(updateIncomeValidator), incomeController.update);
router.delete('/:id', incomeController.delete);

export default router;
