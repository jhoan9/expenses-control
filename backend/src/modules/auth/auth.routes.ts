import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import { registerValidator, loginValidator, refreshTokenValidator } from './auth.validator';

const router = Router();

router.post('/register', validate(registerValidator), authController.register);
router.post('/login', validate(loginValidator), authController.login);
router.post('/refresh', validate(refreshTokenValidator), authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);

export default router;
