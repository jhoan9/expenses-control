import { Request, Response, NextFunction } from 'express';
import { budgetService } from './budget.service';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class BudgetController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const budgets = await budgetService.findAll(req.userId!);
      res.json({
        success: true,
        data: budgets,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const budget = await budgetService.findById(id, req.userId!);
      res.json({
        success: true,
        data: budget,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const budget = await budgetService.create(req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: budget,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const budget = await budgetService.update(id, req.userId!, req.body);
      res.json({
        success: true,
        data: budget,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await budgetService.delete(id, req.userId!);
      res.json({
        success: true,
        message: 'Budget deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async addItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const budgetId = parseInt(req.params.id);
      const item = await budgetService.addItem(budgetId, req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const budgetId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      const item = await budgetService.updateItem(itemId, budgetId, req.userId!, req.body);
      res.json({
        success: true,
        data: item,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const budgetId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      await budgetService.deleteItem(itemId, budgetId, req.userId!);
      res.json({
        success: true,
        message: 'Budget item deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async bulkItems(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const budgetId = parseInt(req.params.id);
      const budget = await budgetService.bulkUpdateItems(budgetId, req.userId!, req.body);
      res.json({
        success: true,
        data: budget,
      });
    } catch (error) {
      next(error);
    }
  }

  async copyNext(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const budgetId = parseInt(req.params.id);
      const budget = await budgetService.copyNext(budgetId, req.userId!);
      res.status(201).json({
        success: true,
        data: budget,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const summary = await budgetService.getSummary(id, req.userId!);
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const budgetController = new BudgetController();
