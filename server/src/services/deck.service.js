// Logique métier des decks (création / édition / suppression, avec règles de validation).
import { prisma } from '../config/prisma.js';
import { ApiError } from '../middleware/errorHandler.js';

// Règles de construction (constantes de game design).
export const DECK_RULES = {
  minCards: 16,
  maxCards: 50,
  maxCopies: 4,
};

// Normalise et valide la liste de cartes envoyée par le client.
async function validateCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new ApiError(400, 'Le deck doit contenir au moins une carte');
  }

  const normalized = cards.map((c) => ({
    cardId: Number(c.cardId),
    quantity: Math.max(1, Number(c.quantity) || 1),
  }));

  // Vérifie l'existence des cartes.
  const ids = normalized.map((c) => c.cardId);
  const found = await prisma.card.findMany({ where: { id: { in: ids } }, select: { id: true } });
  const foundIds = new Set(found.map((c) => c.id));
  for (const c of normalized) {
    if (!foundIds.has(c.cardId)) throw new ApiError(400, `Carte inexistante : ${c.cardId}`);
    if (c.quantity > DECK_RULES.maxCopies) {
      throw new ApiError(400, `Max ${DECK_RULES.maxCopies} exemplaires par carte`);
    }
  }

  const total = normalized.reduce((s, c) => s + c.quantity, 0);
  if (total < DECK_RULES.minCards || total > DECK_RULES.maxCards) {
    throw new ApiError(400, `Le deck doit contenir entre ${DECK_RULES.minCards} et ${DECK_RULES.maxCards} cartes (actuellement ${total})`);
  }

  return normalized;
}

const deckInclude = { deckCards: { include: { card: true } } };

export async function listByUser(userId) {
  return prisma.deck.findMany({
    where: { userId },
    include: deckInclude,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOwned(userId, deckId) {
  const deck = await prisma.deck.findUnique({ where: { id: deckId }, include: deckInclude });
  if (!deck) throw new ApiError(404, 'Deck introuvable');
  if (deck.userId !== userId) throw new ApiError(403, 'Ce deck ne vous appartient pas');
  return deck;
}

export async function create(userId, { name, cards }) {
  if (!name || !name.trim()) throw new ApiError(400, 'Le nom du deck est requis');
  const validated = await validateCards(cards);

  return prisma.deck.create({
    data: {
      name: name.trim(),
      userId,
      deckCards: { create: validated },
    },
    include: deckInclude,
  });
}

export async function update(userId, deckId, { name, cards }) {
  await getOwned(userId, deckId); // vérifie la propriété

  const data = {};
  if (name !== undefined) {
    if (!name.trim()) throw new ApiError(400, 'Le nom du deck ne peut pas être vide');
    data.name = name.trim();
  }

  // Si des cartes sont fournies, on remplace intégralement la composition.
  if (cards !== undefined) {
    const validated = await validateCards(cards);
    await prisma.deckCard.deleteMany({ where: { deckId } });
    data.deckCards = { create: validated };
  }

  return prisma.deck.update({ where: { id: deckId }, data, include: deckInclude });
}

export async function remove(userId, deckId) {
  await getOwned(userId, deckId);
  await prisma.deck.delete({ where: { id: deckId } });
}
