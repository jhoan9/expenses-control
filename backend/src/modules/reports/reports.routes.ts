import { Router } from 'express';
import { reportsController } from './reports.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/dashboard', reportsController.getDashboard);
router.get('/expenses', reportsController.getExpensesSummary);
router.get('/income', reportsController.getIncomeSummary);
router.get('/investments', reportsController.getInvestmentsSummary);
router.get('/accounts', reportsController.getAccountsSummary);
router.get('/budget', reportsController.getBudgetSummary);

export default router;
