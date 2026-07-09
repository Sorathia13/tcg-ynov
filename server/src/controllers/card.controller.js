// Controller cartes — consultation du catalogue (route publique).
import { prisma } from '../config/prisma.js';
import { ApiError } from '../middleware/errorHandler.js';

// GET /api/cards?page=1&limit=50&search=dragon&grade=2
export async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const { search, grade, type } = req.query;

    const where = {};
    if (search) where.name = { contains: String(search), mode: 'insensitive' };
    if (grade !== undefined && grade !== '') where.grade = Number(grade);
    if (type) where.type = String(type);

    const [total, cards] = await Promise.all([
      prisma.card.count({ where }),
      prisma.card.findMany({
        where,
        orderBy: [{ grade: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({ data: cards, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
}

// GET /api/cards/:id
export async function getById(req, res, next) {
  try {
    const id = Number(req.params.id);
    const card = await prisma.card.findUnique({
      where: { id },
      include: { effects: true },
    });
    if (!card) throw new ApiError(404, 'Carte introuvable');
    res.json(card);
  } catch (err) { next(err); }
}
