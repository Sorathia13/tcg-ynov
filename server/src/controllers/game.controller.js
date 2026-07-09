// Controller parties — historique et détail (les parties elles-mêmes se jouent via WebSocket).
import { prisma } from '../config/prisma.js';
import { ApiError } from '../middleware/errorHandler.js';

// GET /api/games — historique des parties du joueur connecté.
export async function listMine(req, res, next) {
  try {
    const games = await prisma.game.findMany({
      where: { participations: { some: { userId: req.user.id } } },
      include: { participations: { include: { user: { select: { id: true, pseudo: true } } } } },
      orderBy: { gameDate: 'desc' },
      take: 50,
    });
    res.json(games);
  } catch (err) { next(err); }
}

// GET /api/games/:id — détail d'une partie (avec tours journalisés).
export async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        participations: { include: { user: { select: { id: true, pseudo: true } } } },
        turns: { orderBy: { turnNumber: 'asc' } },
      },
    });
    if (!game) throw new ApiError(404, 'Partie introuvable');

    const isParticipant = game.participations.some((p) => p.userId === req.user.id);
    if (!isParticipant) throw new ApiError(403, 'Vous ne participez pas à cette partie');

    res.json(game);
  } catch (err) { next(err); }
}
