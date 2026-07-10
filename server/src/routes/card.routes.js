import { Router } from 'express';
import * as cardController from '../controllers/card.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Consultation publique du catalogue (dossier d'intention : "Consultation des cartes").
router.get('/', cardController.list);
router.get('/:id', cardController.getById);

// Création réservée aux administrateurs (démontre la gestion des rôles).
router.post('/', requireAuth, requireRole('admin'), cardController.create);

export default router;
