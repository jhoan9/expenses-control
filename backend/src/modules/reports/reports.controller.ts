import { Request, Response, NextFunction } from 'express';
import { reportsService } from './reports.service';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class ReportsController {
  async getDashboard(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dashboard = await reportsService.getDashboard(req.userId!);
      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      next(error);
    }
  }

  async getExpensesSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
      };
      const summary = await reportsService.getExpensesSummary(req.userId!, filters);
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  async getIncomeSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
      };
      const summary = await reportsService.getIncomeSummary(req.userId!, filters);
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  async getInvestmentsSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await reportsService.getInvestmentsSummary(req.userId!);
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAccountsSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await reportsService.getAccountsSummary(req.userId!);
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  async getBudgetSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const budgetId = req.query.budget_id ? parseInt(req.query.budget_id as string) : undefined;
      const summary = await reportsService.getBudgetSummary(req.userId!, budgetId);
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reportsController = new ReportsController();
