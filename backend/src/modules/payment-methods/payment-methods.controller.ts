import { Request, Response, NextFunction } from 'express';
import { paymentMethodsService } from './payment-methods.service';

export class PaymentMethodsController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paymentMethods = await paymentMethodsService.findAll();
      res.json({
        success: true,
        data: paymentMethods,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const paymentMethod = await paymentMethodsService.findById(id);
      res.json({
        success: true,
        data: paymentMethod,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const paymentMethod = await paymentMethodsService.create(req.body);
      res.status(201).json({
        success: true,
        data: paymentMethod,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const paymentMethod = await paymentMethodsService.update(id, req.body);
      res.json({
        success: true,
        data: paymentMethod,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await paymentMethodsService.delete(id);
      res.json({
        success: true,
        message: 'Payment method deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const paymentMethodsController = new PaymentMethodsController();
