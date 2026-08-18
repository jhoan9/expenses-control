import { Router } from 'express';
import { thirdPartyController } from './third-party.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { validate } from '../../shared/middleware/validate.middleware';
import {
  createThirdPartyValidator,
  updateThirdPartyValidator,
  createMovementValidator,
} from './third-party.validator';

const router = Router();

router.use(authenticate);

router.get('/', thirdPartyController.getAll);
router.get('/:id', thirdPartyController.getById);
router.get('/:id/summary', thirdPartyController.getSummary);
router.post('/', validate(createThirdPartyValidator), thirdPartyController.create);
router.put('/:id', validate(updateThirdPartyValidator), thirdPartyController.update);
router.delete('/:id', thirdPartyController.delete);

router.post('/:id/movements', validate(createMovementValidator), thirdPartyController.addMovement);

export default router;
