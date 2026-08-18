import { Request, Response, NextFunction } from 'express';
import { incomeService } from './income.service';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class IncomeController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        category_id: req.query.category_id ? parseInt(req.query.category_id as string) : undefined,
        account_id: req.query.account_id ? parseInt(req.query.account_id as string) : undefined,
      };

      const result = await incomeService.findAll(req.userId!, filters, page, limit);
      res.json({
        success: true,
        data: result.income,
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
      const income = await incomeService.findById(id, req.userId!);
      res.json({
        success: true,
        data: income,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const income = await incomeService.create(req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: income,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const income = await incomeService.update(id, req.userId!, req.body);
      res.json({
        success: true,
        data: income,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await incomeService.delete(id, req.userId!);
      res.json({
        success: true,
        message: 'Income deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const incomeController = new IncomeController();
