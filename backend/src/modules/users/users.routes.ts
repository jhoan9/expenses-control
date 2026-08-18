import { Router } from 'express';
import { usersController } from './users.controller';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import { createUserValidator, updateUserValidator } from './users.validator';

const router = Router();

router.get('/me', authenticate, usersController.getProfile);
router.put('/me', authenticate, validate(updateUserValidator), usersController.updateProfile);

router.get('/', authenticate, authorize('admin'), usersController.getAll);
router.get('/:id', authenticate, authorize('admin'), usersController.getById);
router.post('/', authenticate, authorize('admin'), validate(createUserValidator), usersController.create);
router.put('/:id', authenticate, authorize('admin'), validate(updateUserValidator), usersController.update);
router.delete('/:id', authenticate, authorize('admin'), usersController.delete);

export default router;
