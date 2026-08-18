import { Request, Response, NextFunction } from 'express';
import { creditsService } from './credits.service';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class CreditsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const credits = await creditsService.findAll(req.userId!);
      res.json({
        success: true,
        data: credits,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const credit = await creditsService.findById(id, req.userId!);
      res.json({
        success: true,
        data: credit,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const credit = await creditsService.create(req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: credit,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const credit = await creditsService.update(id, req.userId!, req.body);
      res.json({
        success: true,
        data: credit,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await creditsService.delete(id, req.userId!);
      res.json({
        success: true,
        message: 'Credit deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async addPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const creditId = parseInt(req.params.id);
      const payment = await creditsService.addPayment(creditId, req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  }

  async deletePayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const creditId = parseInt(req.params.id);
      const paymentId = parseInt(req.params.paymentId);
      await creditsService.deletePayment(paymentId, creditId, req.userId!);
      res.json({
        success: true,
        message: 'Payment deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await creditsService.getSummary(req.userId!);
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const creditsController = new CreditsController();
