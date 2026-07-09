// ============================================================================
//  Gestionnaire de parties — orchestre le moteur, garde l'état en mémoire,
//  persiste le cycle de vie en BDD (games / participations / turns) et pilote
//  l'IA. Le serveur est AUTORITAIRE : toute action passe par ici.
// ============================================================================
import { prisma } from '../config/prisma.js';
import * as engine from './game.engine.js';
import * as ai from './ai.service.js';

// gameId -> { state, sides, aiPlan }
const games = new Map();

// Identifiants de camp
const SIDES = ['A', 'B'];

// ---------------------------------------------------------------------------
//  Création de parties
// ---------------------------------------------------------------------------

// Assure l'existence d'un utilisateur système représentant l'IA (pour les FK).
async function ensureAIUser() {
  const email = 'ai@tcg.dev';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { pseudo: 'IA — Ollama', email, password: 'not-loginnable' },
    });
  }
  return user;
}

// Compose un deck IA à partir du catalogue (mélange équilibré tous grades confondus).
export async function buildDefaultAIDeck() {
  const cards = await prisma.card.findMany();
  if (cards.length === 0) throw new Error('Aucune carte en base : lancez le seed.');
  const byGrade = (g) => cards.filter((c) => c.grade === g);
  const pick = (arr, q) => arr.slice(0, q).map((card) => ({ quantity: 4, card }));
  // 4 exemplaires des premières cartes de chaque grade -> deck valide (~ 28-40 cartes).
  return [
    ...pick(byGrade(0), 3),
    ...pick(byGrade(1), 2),
    ...pick(byGrade(2), 2),
    ...pick(byGrade(3), 2),
  ];
}

// Crée une partie Humain vs IA.
export async function createVsAI({ user, deckCards, seed }) {
  const aiUser = await ensureAIUser();
  const aiDeck = await buildDefaultAIDeck();

  const game = await prisma.game.create({
    data: {
      status: 'playing',
      participations: {
        create: [
          { userId: user.id, role: 'player', lifePoints: engine.RULES.STARTING_LIFE },
          { userId: aiUser.id, role: 'ai', lifePoints: engine.RULES.STARTING_LIFE },
        ],
      },
    },
  });

  const state = engine.createGameState({
    id: game.id,
    playerA: { userId: user.id, name: user.pseudo, isAI: false, deckCards },
    playerB: { userId: aiUser.id, name: 'IA — Ollama', isAI: true, deckCards: aiDeck },
    seed: seed || game.id * 7919 + 1,
  });

  games.set(game.id, {
    state,
    sides: { A: { userId: user.id, isAI: false }, B: { userId: aiUser.id, isAI: true } },
    aiPlan: null,
  });
  return game.id;
}

// Crée une partie PvP (deux humains).
export async function createPvP(a, b, seed) {
  const game = await prisma.game.create({
    data: {
      status: 'playing',
      participations: {
        create: [
          { userId: a.user.id, role: 'player', lifePoints: engine.RULES.STARTING_LIFE },
          { userId: b.user.id, role: 'player', lifePoints: engine.RULES.STARTING_LIFE },
        ],
      },
    },
  });

  const state = engine.createGameState({
    id: game.id,
    playerA: { userId: a.user.id, name: a.user.pseudo, isAI: false, deckCards: a.deckCards },
    playerB: { userId: b.user.id, name: b.user.pseudo, isAI: false, deckCards: b.deckCards },
    seed: seed || game.id * 7919 + 1,
  });

  games.set(game.id, {
    state,
    sides: { A: { userId: a.user.id, isAI: false }, B: { userId: b.user.id, isAI: false } },
    aiPlan: null,
  });
  return game.id;
}

// ---------------------------------------------------------------------------
//  Accès / vues
// ---------------------------------------------------------------------------
export function get(gameId) {
  return games.get(gameId);
}

// Camp d'un utilisateur dans une partie ('A' | 'B' | null).
export function sideOf(gameId, userId) {
  const entry = games.get(gameId);
  if (!entry) return null;
  for (const s of SIDES) if (entry.sides[s].userId === userId) return s;
  return null;
}

export function viewFor(gameId, side) {
  const entry = games.get(gameId);
  if (!entry) return null;
  return engine.publicView(entry.state, side);
}

// ---------------------------------------------------------------------------
//  Application d'une action humaine (validée par le moteur)
// ---------------------------------------------------------------------------
export async function applyHumanAction(gameId, side, action) {
  const entry = games.get(gameId);
  if (!entry) throw new Error('Partie introuvable.');
  const { state } = entry;

  switch (action.type) {
    case 'deploy':
      engine.deploy(state, side, action.iids || []);
      break;
    case 'attack':
      engine.declareAttack(state, side, action.attackerIid);
      break;
    case 'guard':
      engine.resolveGuard(state, side, action.guardIids || []);
      break;
    case 'endTurn':
      engine.endTurn(state, side);
      await persistTurn(entry, side);
      break;
    default:
      throw new Error(`Action inconnue : ${action.type}`);
  }

  if (state.status === 'finished') await persistEnd(entry);
  return state;
}

// ---------------------------------------------------------------------------
//  Pilotage de l'IA
//  Renvoie la liste des étapes appliquées ; `onStep` (optionnel) est awaité
//  après chaque étape pour permettre au socket d'animer la diffusion.
// ---------------------------------------------------------------------------

// Détermine si un camp IA doit agir maintenant, et lequel.
function pendingAISide(entry) {
  const { state, sides } = entry;
  if (state.status !== 'playing') return null;
  if (state.pendingAttack) {
    const def = engine.opponentOf(state.pendingAttack.from);
    return sides[def].isAI ? def : null;
  }
  return sides[state.activePlayer].isAI ? state.activePlayer : null;
}

export async function advanceAI(gameId, onStep) {
  const entry = games.get(gameId);
  if (!entry) return;
  const { state } = entry;

  let guard = 0; // garde-fou anti-boucle infinie
  while (guard++ < 40) {
    const side = pendingAISide(entry);
    if (!side) break;

    // --- Défense de l'IA ---
    if (state.pendingAttack) {
      const view = engine.publicView(state, side);
      const { guardIids } = await ai.decideGuard(view);
      engine.resolveGuard(state, side, guardIids);
      if (state.status === 'finished') await persistEnd(entry);
      if (onStep) await onStep();
      continue;
    }

    // --- Tour actif de l'IA ---
    // (Re)planifie le tour si nécessaire.
    if (!entry.aiPlan || entry.aiPlan.turn !== state.turn) {
      const view = engine.publicView(state, side);
      const plan = await ai.decideTurn(view);
      // Déploiement (filtré/validé par le moteur, on ignore les coups illégaux).
      const deployable = new Set(view.legal.deployable?.map((c) => c.iid));
      const toDeploy = (plan.deploy || []).filter((iid) => deployable.has(iid))
        .slice(0, engine.RULES.FIELD_SIZE - state.players[side].field.length);
      if (toDeploy.length) {
        try { engine.deploy(state, side, toDeploy); } catch { /* ignore illégal */ }
      }
      entry.aiPlan = { turn: state.turn, attacks: [...(plan.attacks || [])] };
      if (onStep) await onStep();
      continue;
    }

    // Exécute la prochaine attaque planifiée.
    const plan = entry.aiPlan;
    let attackerIid = null;
    while (plan.attacks.length > 0) {
      const candidate = plan.attacks.shift();
      const unit = state.players[side].field.find((u) => u.iid === candidate && !u.tapped);
      if (unit) { attackerIid = candidate; break; }
    }

    if (attackerIid) {
      engine.declareAttack(state, side, attackerIid);
      if (onStep) await onStep();
      // La résolution de la garde se fait à l'itération suivante (IA) ou attend l'humain.
      continue;
    }

    // Plus d'attaque -> fin du tour de l'IA.
    engine.endTurn(state, side);
    entry.aiPlan = null;
    await persistTurn(entry, side);
    if (onStep) await onStep();
  }
}

// L'IA doit-elle réagir (utilisé par le socket pour savoir s'il faut appeler advanceAI) ?
export function aiShouldAct(gameId) {
  const entry = games.get(gameId);
  return entry ? !!pendingAISide(entry) : false;
}

// ---------------------------------------------------------------------------
//  Persistance
// ---------------------------------------------------------------------------
async function persistTurn(entry, side) {
  try {
    await prisma.turn.create({
      data: {
        turnNumber: entry.state.turn,
        gameId: entry.state.id,
        userId: entry.sides[side].userId,
      },
    });
  } catch (e) { console.error('[persistTurn]', e.message); }
}

async function persistEnd(entry) {
  const { state } = entry;
  try {
    await prisma.game.update({ where: { id: state.id }, data: { status: 'finished' } });
    for (const s of SIDES) {
      await prisma.participation.update({
        where: { userId_gameId: { userId: entry.sides[s].userId, gameId: state.id } },
        data: { lifePoints: state.players[s].life },
      });
    }
  } catch (e) { console.error('[persistEnd]', e.message); }
}

// Libère la mémoire (parties terminées / abandonnées).
export function dispose(gameId) {
  games.delete(gameId);
}
