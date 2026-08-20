import { Request, Response, NextFunction } from 'express';
import { accountsService } from './accounts.service';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class AccountsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await accountsService.findAllByUser(req.userId!);
      res.json({
        success: true,
        data: accounts,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const account = await accountsService.findById(id, req.userId!);
      res.json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const account = await accountsService.create(req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const account = await accountsService.update(id, req.userId!, req.body);
      res.json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await accountsService.delete(id, req.userId!);
      res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async transfer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const account = await accountsService.transfer(id, req.body.to_account_id, req.userId!, req.body);
      res.json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }

  async creditCardPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const account = await accountsService.creditCardPayment(id, req.userId!, req.body);
      res.json({
        success: true,
        data: account,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const accountsController = new AccountsController();
