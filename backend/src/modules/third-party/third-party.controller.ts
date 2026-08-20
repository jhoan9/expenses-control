import { Request, Response, NextFunction } from 'express';
import { thirdPartyService } from './third-party.service';
import { AuthRequest } from '../../shared/middleware/auth.middleware';

export class ThirdPartyController {
  async getAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const accounts = await thirdPartyService.findAll(req.userId!);
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
      const account = await thirdPartyService.findById(id, req.userId!);
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
      const account = await thirdPartyService.create(req.userId!, req.body);
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
      const account = await thirdPartyService.update(id, req.userId!, req.body);
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
      await thirdPartyService.delete(id, req.userId!);
      res.json({
        success: true,
        message: 'Third party account deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async addMovement(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const thirdPartyId = parseInt(req.params.id);
      const movement = await thirdPartyService.addMovement(thirdPartyId, req.userId!, req.body);
      res.status(201).json({
        success: true,
        data: movement,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const summary = await thirdPartyService.getSummary(id, req.userId!);
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const thirdPartyController = new ThirdPartyController();
