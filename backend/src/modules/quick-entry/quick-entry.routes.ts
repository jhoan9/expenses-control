import { Router } from 'express';
import { authenticateUserOrToken } from '../../shared/middleware/api-token.middleware';
import { quickEntryController } from './quick-entry.controller';

/**
 * Registro rápido. Acepta la sesión web o un token personal ("ctl_..."),
 * así lo pueden usar Atajos de iPhone y automatizaciones de Android.
 */
const router = Router();

router.use(authenticateUserOrToken);

router.post('/entries', quickEntryController.create);
router.post('/undo', quickEntryController.undo);
router.get('/summary', quickEntryController.summary);
router.get('/options', quickEntryController.options);

export default router;
