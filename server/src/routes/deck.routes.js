import { Router } from 'express';
import * as deckController from '../controllers/deck.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Toutes les routes de decks nécessitent une authentification.
router.use(requireAuth);

router.get('/', deckController.list);
router.post('/', deckController.create);
router.get('/:id', deckController.getById);
router.put('/:id', deckController.update);
router.delete('/:id', deckController.remove);

export default router;
