import { Router } from 'express';
import { categoriesController } from './categories.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  createCategoryValidator,
  updateCategoryValidator,
  createSubcategoryValidator,
} from './categories.validator';

const router = Router();

router.get('/', authenticate, categoriesController.getAll);
router.get('/:id', authenticate, categoriesController.getById);
router.post('/', authenticate, validate(createCategoryValidator), categoriesController.create);
router.put('/:id', authenticate, validate(updateCategoryValidator), categoriesController.update);
router.delete('/:id', authenticate, categoriesController.delete);

router.post('/:id/subcategories', authenticate, validate(createSubcategoryValidator), categoriesController.addSubcategory);
router.put('/:id/subcategories/:subcategoryId', authenticate, validate(createSubcategoryValidator), categoriesController.updateSubcategory);
router.delete('/:id/subcategories/:subcategoryId', authenticate, categoriesController.deleteSubcategory);

export default router;
