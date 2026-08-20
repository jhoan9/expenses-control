import { Request, Response, NextFunction } from 'express';
import { investmentsService } from './investments.service';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class InvestmentsController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const investments = await investmentsService.findAll(req.userId!);
      res.json({
        success: true,
        data: investments,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const investment = await investmentsService.findById(id, req.userId!);
      res.json({
        success: true,
        data: investment,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const investment = await investmentsService.create(req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: investment,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const investment = await investmentsService.update(id, req.userId!, req.body);
      res.json({
        success: true,
        data: investment,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await investmentsService.delete(id, req.userId!);
      res.json({
        success: true,
        message: 'Investment deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async buy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const investmentId = parseInt(req.params.id);
      const position = await investmentsService.buy(investmentId, req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: position,
      });
    } catch (error) {
      next(error);
    }
  }

  async sell(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const investmentId = parseInt(req.params.id);
      const position = await investmentsService.sell(investmentId, req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: position,
      });
    } catch (error) {
      next(error);
    }
  }

  async getOpenPositions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const positions = await investmentsService.getOpenPositions(req.userId!);
      res.json({
        success: true,
        data: positions,
      });
    } catch (error) {
      next(error);
    }
  }

  async getClosedPositions(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const positions = await investmentsService.getClosedPositions(req.userId!);
      res.json({
        success: true,
        data: positions,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const investmentsController = new InvestmentsController();
