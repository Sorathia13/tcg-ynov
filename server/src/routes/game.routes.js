import { Router } from 'express';
import * as gameController from '../controllers/game.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', gameController.listMine);
router.get('/:id', gameController.getById);

export default router;
