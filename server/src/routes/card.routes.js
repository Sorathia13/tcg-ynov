import { Router } from 'express';
import * as cardController from '../controllers/card.controller.js';

const router = Router();

// Consultation publique du catalogue (dossier d'intention : "Consultation des cartes").
router.get('/', cardController.list);
router.get('/:id', cardController.getById);

export default router;
