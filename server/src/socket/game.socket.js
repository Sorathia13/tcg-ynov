// ============================================================================
//  Couche temps réel (Socket.io) — synchronise le déroulé des parties.
//  Serveur AUTORITAIRE : le client n'envoie que des INTENTIONS (game:action),
//  validées par le moteur via le game.manager, puis l'état à jour est rediffusé.
// ============================================================================
import { prisma } from '../config/prisma.js';
import { verifyToken } from '../middleware/auth.js';
import * as manager from '../services/game.manager.js';
import * as matchmaking from '../services/matchmaking.js';

// gameId -> { A?: socket, B?: socket }  (sockets connectés par camp)
const rooms = new Map();

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function roomName(gameId) { return `game:${gameId}`; }

function registerSocket(gameId, side, socket) {
  const r = rooms.get(gameId) || {};
  r[side] = socket;
  rooms.set(gameId, r);
  socket.join(roomName(gameId));
  socket.data.gameId = gameId;
  socket.data.side = side;
}

// Diffuse à chaque joueur SA vue personnalisée (main adverse masquée).
function broadcast(gameId) {
  const r = rooms.get(gameId);
  if (!r) return;
  for (const side of ['A', 'B']) {
    const sock = r[side];
    if (!sock) continue;
    const view = manager.viewFor(gameId, side);
    if (!view) continue;
    sock.emit('game:state', view);
    if (view.status === 'finished') {
      sock.emit('game:over', { winner: view.winner, youWon: view.winner === side });
    }
  }
}

// Fait jouer l'IA (si c'est son tour), en animant chaque étape.
async function runAIIfNeeded(gameId, io) {
  if (!manager.aiShouldAct(gameId)) return;
  await manager.advanceAI(gameId, async () => {
    broadcast(gameId);
    await delay(800); // pacing pour la lisibilité de la démo
  });
  broadcast(gameId);
}

// Charge la composition d'un deck en vérifiant la propriété.
async function loadOwnedDeck(userId, deckId) {
  const deck = await prisma.deck.findUnique({
    where: { id: Number(deckId) },
    include: { deckCards: { include: { card: true } } },
  });
  if (!deck) throw new Error('Deck introuvable.');
  if (deck.userId !== userId) throw new Error('Ce deck ne vous appartient pas.');
  if (deck.deckCards.length === 0) throw new Error('Ce deck est vide.');
  return deck.deckCards;
}

export function registerGameSocket(io) {
  // Authentification au handshake (même JWT que l'API REST).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = token && verifyToken(token);
    if (!payload) return next(new Error('Authentification requise'));
    socket.data.user = { id: payload.sub, pseudo: payload.pseudo, email: payload.email };
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    // --- Partie contre l'IA ---
    socket.on('game:vsAI', async ({ deckId }) => {
      try {
        const deckCards = await loadOwnedDeck(user.id, deckId);
        const gameId = await manager.createVsAI({ user, deckCards });
        registerSocket(gameId, 'A', socket); // l'humain est toujours le camp A
        socket.emit('game:started', { gameId, mode: 'ai' });
        broadcast(gameId);
        // no-op au 1er tour (l'humain commence), mais passe par le verrou par cohérence
        await manager.runExclusive(gameId, () => runAIIfNeeded(gameId, io));
      } catch (err) {
        socket.emit('game:error', { message: err.message });
      }
    });

    // --- Matchmaking PvP ---
    socket.on('queue:join', async ({ deckId }) => {
      try {
        const deckCards = await loadOwnedDeck(user.id, deckId);
        socket.emit('queue:waiting', { position: matchmaking.size() + 1 });
        const pair = matchmaking.join({ socketId: socket.id, user, deckCards, socket });
        if (!pair) return;

        const [a, b] = pair;
        const gameId = await manager.createPvP(
          { user: a.user, deckCards: a.deckCards },
          { user: b.user, deckCards: b.deckCards },
        );
        registerSocket(gameId, 'A', a.socket);
        registerSocket(gameId, 'B', b.socket);
        a.socket.emit('game:started', { gameId, mode: 'pvp' });
        b.socket.emit('game:started', { gameId, mode: 'pvp' });
        broadcast(gameId);
      } catch (err) {
        socket.emit('game:error', { message: err.message });
      }
    });

    socket.on('queue:leave', () => {
      matchmaking.leave(socket.id);
      socket.emit('queue:left', {});
    });

    // --- Abandon de partie ---
    socket.on('game:forfeit', async ({ gameId }) => {
      gameId = Number(gameId);
      const side = manager.sideOf(gameId, user.id);
      if (!side) { socket.emit('game:left', {}); return; }

      await manager.runExclusive(gameId, async () => {
        await manager.forfeit(gameId, side);
        // Prévient l'adversaire humain (PvP) qu'il gagne par abandon.
        const r = rooms.get(gameId) || {};
        const opp = side === 'A' ? 'B' : 'A';
        if (r[opp]) {
          r[opp].emit('game:state', manager.viewFor(gameId, opp));
          r[opp].emit('game:over', { winner: manager.get(gameId)?.state.winner, youWon: true, reason: 'forfeit' });
        }
      });
      // L'abandonneur revient proprement au salon.
      socket.emit('game:left', {});
      manager.dispose(gameId);
    });

    // --- Action de jeu ---
    // Tout le cycle (action humaine → diffusion → tour IA) s'exécute sous verrou
    // exclusif par partie : aucune interleaving possible avec le tour asynchrone de l'IA.
    socket.on('game:action', async ({ gameId, action }) => {
      gameId = Number(gameId);
      const side = manager.sideOf(gameId, user.id);
      if (!side) {
        socket.emit('game:error', { message: 'Vous ne participez pas à cette partie.' });
        return;
      }
      try {
        await manager.runExclusive(gameId, async () => {
          await manager.applyHumanAction(gameId, side, action);
          broadcast(gameId);
          await runAIIfNeeded(gameId, io);
        });
      } catch (err) {
        socket.emit('game:error', { message: err.message, recoverable: !!err.isGameError });
        // Resynchronise le client après un coup refusé.
        broadcast(gameId);
      }
    });

    socket.on('disconnect', () => {
      matchmaking.leave(socket.id);
      const gameId = socket.data.gameId;
      if (gameId && rooms.has(gameId)) {
        const r = rooms.get(gameId);
        // Prévient l'adversaire éventuel de la déconnexion.
        for (const s of ['A', 'B']) {
          if (r[s] && r[s].id !== socket.id) r[s].emit('game:opponentLeft', {});
        }
      }
    });
  });
}
