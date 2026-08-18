import { Router } from 'express';
import { categoriesController } from './categories.controller';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  createCategoryValidator,
  updateCategoryValidator,
  createSubcategoryValidator,
} from './categories.validator';

const router = Router();

router.get('/', categoriesController.getAll);
router.get('/:id', categoriesController.getById);
router.post('/', authenticate, authorize('admin'), validate(createCategoryValidator), categoriesController.create);
router.put('/:id', authenticate, authorize('admin'), validate(updateCategoryValidator), categoriesController.update);
router.delete('/:id', authenticate, authorize('admin'), categoriesController.delete);

router.post('/:id/subcategories', authenticate, authorize('admin'), validate(createSubcategoryValidator), categoriesController.addSubcategory);
router.put('/:id/subcategories/:subcategoryId', authenticate, authorize('admin'), validate(createSubcategoryValidator), categoriesController.updateSubcategory);
router.delete('/:id/subcategories/:subcategoryId', authenticate, authorize('admin'), categoriesController.deleteSubcategory);

export default router;
