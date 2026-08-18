import { Request, Response, NextFunction } from 'express';
import { expensesService } from './expenses.service';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class ExpensesController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        category_id: req.query.category_id ? parseInt(req.query.category_id as string) : undefined,
        subcategory_id: req.query.subcategory_id ? parseInt(req.query.subcategory_id as string) : undefined,
        account_id: req.query.account_id ? parseInt(req.query.account_id as string) : undefined,
        payment_method_id: req.query.payment_method_id ? parseInt(req.query.payment_method_id as string) : undefined,
        status: req.query.status as string,
      };

      const result = await expensesService.findAll(req.userId!, filters, page, limit);
      res.json({
        success: true,
        data: result.expenses,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const expense = await expensesService.findById(id, req.userId!);
      res.json({
        success: true,
        data: expense,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const expense = await expensesService.create(req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: expense,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const expense = await expensesService.update(id, req.userId!, req.body);
      res.json({
        success: true,
        data: expense,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await expensesService.delete(id, req.userId!);
      res.json({
        success: true,
        message: 'Expense deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      const summary = await expensesService.getSummary(req.userId!, dateFrom, dateTo);
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }

  async getByCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dateFrom = req.query.date_from as string;
      const dateTo = req.query.date_to as string;
      const byCategory = await expensesService.getByCategory(req.userId!, dateFrom, dateTo);
      res.json({
        success: true,
        data: byCategory,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const expensesController = new ExpensesController();
