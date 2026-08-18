import { Request, Response, NextFunction } from 'express';
import { loansService } from './loans.service';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class LoansController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const loans = await loansService.findAll(req.userId!);
      res.json({
        success: true,
        data: loans,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const loan = await loansService.findById(id, req.userId!);
      res.json({
        success: true,
        data: loan,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const loan = await loansService.create(req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: loan,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const loan = await loansService.update(id, req.userId!, req.body);
      res.json({
        success: true,
        data: loan,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await loansService.delete(id, req.userId!);
      res.json({
        success: true,
        message: 'Loan deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async addPayment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const loanId = parseInt(req.params.id);
      const payment = await loansService.addPayment(loanId, req.userId!, req.body);
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
      const loanId = parseInt(req.params.id);
      const paymentId = parseInt(req.params.paymentId);
      await loansService.deletePayment(paymentId, loanId, req.userId!);
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
      const summary = await loansService.getSummary(req.userId!);
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const loansController = new LoansController();
