import { Request, Response, NextFunction } from 'express';
import { categoriesService } from './categories.service';

export class CategoriesController {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const type = req.query.type as string;
      const categories = await categoriesService.findAll(type);
      res.json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const category = await categoriesService.findById(id);
      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoriesService.create(req.body);
      res.status(201).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      const category = await categoriesService.update(id, req.body);
      res.json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id);
      await categoriesService.delete(id);
      res.json({
        success: true,
        message: 'Category deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async addSubcategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categoryId = parseInt(req.params.id);
      const subcategory = await categoriesService.addSubcategory(categoryId, req.body);
      res.status(201).json({
        success: true,
        data: subcategory,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateSubcategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.subcategoryId);
      const subcategory = await categoriesService.updateSubcategory(id, req.body);
      res.json({
        success: true,
        data: subcategory,
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteSubcategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.subcategoryId);
      await categoriesService.deleteSubcategory(id);
      res.json({
        success: true,
        message: 'Subcategory deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const categoriesController = new CategoriesController();
