// ============================================================================
//  Moteur de jeu — TCG lite (règles déterministes, fonctions pures)
//  Ce module ne connaît NI Express NI Socket.io : il opère uniquement sur un
//  objet `state`. Cela le rend testable et rejouable (cf. docs/ARCHITECTURE.md §5).
// ============================================================================

export const RULES = {
  STARTING_LIFE: 15,
  HAND_START: 5,
  FIELD_SIZE: 3,
};

// --- RNG déterministe (mulberry32) : mélange reproductible à partir d'une graine ---
function nextRandom(state) {
  let t = (state.rngState += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffleInPlace(arr, state) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Transforme la composition d'un deck (deckCards) en une pile de cartes individuelles.
// Chaque carte reçoit un identifiant d'instance unique `iid`.
function buildPile(deckCards, prefix) {
  const pile = [];
  let n = 0;
  for (const dc of deckCards) {
    for (let i = 0; i < dc.quantity; i++) {
      pile.push({
        iid: `${prefix}-${n++}`,
        cardId: dc.card.id,
        name: dc.card.name,
        type: dc.card.type,
        grade: dc.card.grade,
        power: dc.card.power,
        critical: dc.card.critical,
        description: dc.card.description,
        tapped: false,
      });
    }
  }
  return pile;
}

function makePlayer({ userId, name, isAI }, deckCards, prefix, state) {
  const deck = shuffleInPlace(buildPile(deckCards, prefix), state);
  const hand = deck.splice(0, RULES.HAND_START);
  return { userId, name, isAI: !!isAI, life: RULES.STARTING_LIFE, deck, hand, field: [], turnCount: 0 };
}

export function opponentOf(side) {
  return side === 'A' ? 'B' : 'A';
}

// --- Création de l'état initial ---------------------------------------------
// playerA / playerB : { userId, name, isAI, deckCards: [{ quantity, card }] }
export function createGameState({ id, playerA, playerB, seed = 1 }) {
  const state = {
    id,
    status: 'playing',
    turn: 0,
    activePlayer: 'A',
    players: {},
    pendingAttack: null, // { from, attackerIid, name, power, critical }
    winner: null,
    log: [],
    rngState: seed >>> 0,
  };
  state.players.A = makePlayer(playerA, playerA.deckCards, 'A', state);
  state.players.B = makePlayer(playerB, playerB.deckCards, 'B', state);

  beginTurn(state, 'A');
  return state;
}

function pushLog(state, type, message) {
  state.log.push({ turn: state.turn, type, message });
}

// Début de tour d'un joueur : untap, pioche, incrément du compteur.
function beginTurn(state, side) {
  const p = state.players[side];
  p.turnCount += 1;
  state.turn += 1;
  state.activePlayer = side;
  for (const u of p.field) u.tapped = false;

  if (p.deck.length > 0) {
    const drawn = p.deck.shift();
    p.hand.push(drawn);
    pushLog(state, 'draw', `${p.name} pioche une carte (tour ${p.turnCount}).`);
  } else {
    pushLog(state, 'draw', `${p.name} n'a plus de cartes à piocher.`);
  }
}

// Grade maximum déployable au tour courant du joueur (progression des grades).
export function maxDeployableGrade(player) {
  return player.turnCount - 1;
}

// --- Actions ----------------------------------------------------------------

// Déploie des unités depuis la main vers le champ.
export function deploy(state, side, iids) {
  assertPlaying(state);
  if (state.pendingAttack) throw gameError('Une attaque est en cours de résolution.');
  if (state.activePlayer !== side) throw gameError('Ce n\'est pas votre tour.');

  const p = state.players[side];
  const maxGrade = maxDeployableGrade(p);
  const list = Array.isArray(iids) ? iids : [iids];

  if (p.field.length + list.length > RULES.FIELD_SIZE) {
    throw gameError(`Champ plein (max ${RULES.FIELD_SIZE} unités).`);
  }

  for (const iid of list) {
    const idx = p.hand.findIndex((c) => c.iid === iid);
    if (idx === -1) throw gameError(`Carte absente de la main : ${iid}`);
    const card = p.hand[idx];
    if (card.grade > maxGrade) {
      throw gameError(`${card.name} (grade ${card.grade}) nécessite d'atteindre le tour ${card.grade + 1}.`);
    }
    p.hand.splice(idx, 1);
    card.tapped = false;
    p.field.push(card);
    pushLog(state, 'deploy', `${p.name} déploie ${card.name} (${card.power}).`);
  }
  return state;
}

// Déclare une attaque : met la partie en attente de la garde adverse.
export function declareAttack(state, side, attackerIid) {
  assertPlaying(state);
  if (state.pendingAttack) throw gameError('Une attaque est déjà en cours.');
  if (state.activePlayer !== side) throw gameError('Ce n\'est pas votre tour.');

  const p = state.players[side];
  const unit = p.field.find((u) => u.iid === attackerIid);
  if (!unit) throw gameError('Unité attaquante introuvable sur le champ.');
  if (unit.tapped) throw gameError(`${unit.name} a déjà attaqué ce tour.`);

  unit.tapped = true;
  state.pendingAttack = {
    from: side,
    attackerIid,
    name: unit.name,
    power: unit.power,
    critical: unit.critical,
  };
  const def = state.players[opponentOf(side)];
  pushLog(state, 'attack', `${p.name} attaque avec ${unit.name} (${unit.power}) → ${def.name}.`);
  return state;
}

// Résout la garde du défenseur : les cartes défaussées forment un bouclier.
export function resolveGuard(state, side, guardIids = []) {
  assertPlaying(state);
  const atk = state.pendingAttack;
  if (!atk) throw gameError('Aucune attaque à défendre.');
  if (side !== opponentOf(atk.from)) throw gameError('Vous n\'êtes pas le défenseur.');

  const def = state.players[side];
  const atkName = state.players[atk.from].name;
  let shield = 0;
  const used = [];

  for (const iid of guardIids) {
    const idx = def.hand.findIndex((c) => c.iid === iid);
    if (idx === -1) throw gameError(`Carte de garde absente de la main : ${iid}`);
    const card = def.hand.splice(idx, 1)[0];
    shield += card.power;
    used.push(card.name);
  }

  if (atk.power > shield) {
    def.life -= atk.critical;
    pushLog(state, 'damage',
      `L'attaque passe (${atk.power} > bouclier ${shield}) : ${def.name} perd ${atk.critical} PV → ${Math.max(0, def.life)} PV.`);
  } else {
    pushLog(state, 'blocked',
      `${def.name} garde avec ${used.join(', ') || '—'} (bouclier ${shield} ≥ ${atk.power}) : attaque bloquée.`);
  }

  state.pendingAttack = null;

  if (def.life <= 0) {
    def.life = 0;
    state.status = 'finished';
    state.winner = atk.from;
    pushLog(state, 'end', `${atkName} remporte la partie !`);
  }
  return state;
}

// Termine le tour du joueur actif et passe la main.
export function endTurn(state, side) {
  assertPlaying(state);
  if (state.pendingAttack) throw gameError('Résolvez l\'attaque en cours avant de finir le tour.');
  if (state.activePlayer !== side) throw gameError('Ce n\'est pas votre tour.');

  pushLog(state, 'endTurn', `${state.players[side].name} termine son tour.`);
  beginTurn(state, opponentOf(side));
  return state;
}

// --- Introspection : quelles actions sont légales pour un camp donné ? -------
export function legalActions(state, side) {
  if (state.status !== 'playing') return { canAct: false };

  // Phase de défense.
  if (state.pendingAttack) {
    const isDefender = side === opponentOf(state.pendingAttack.from);
    return {
      canAct: isDefender,
      mustGuard: isDefender,
      incomingAttack: state.pendingAttack,
      guardHand: isDefender ? state.players[side].hand.map(cardBrief) : [],
    };
  }

  // Phase active.
  if (state.activePlayer !== side) return { canAct: false };
  const p = state.players[side];
  const maxGrade = maxDeployableGrade(p);
  return {
    canAct: true,
    mustGuard: false,
    deployable: p.field.length < RULES.FIELD_SIZE
      ? p.hand.filter((c) => c.grade <= maxGrade).map(cardBrief)
      : [],
    attackers: p.field.filter((u) => !u.tapped).map(cardBrief),
    canEndTurn: true,
  };
}

// --- Vues / sérialisation ----------------------------------------------------
function cardBrief(c) {
  return {
    iid: c.iid, cardId: c.cardId, name: c.name, type: c.type,
    grade: c.grade, power: c.power, critical: c.critical,
    description: c.description, tapped: !!c.tapped,
  };
}

// Vue "publique" adaptée à un joueur : on masque la main et le deck de l'adversaire.
export function publicView(state, viewer) {
  const other = opponentOf(viewer);
  const p = state.players[viewer];
  const o = state.players[other];

  const self = {
    side: viewer, name: p.name, isAI: p.isAI, life: p.life,
    hand: p.hand.map(cardBrief), field: p.field.map(cardBrief),
    deckCount: p.deck.length, turnCount: p.turnCount,
  };
  const opponent = {
    side: other, name: o.name, isAI: o.isAI, life: o.life,
    handCount: o.hand.length, field: o.field.map(cardBrief),
    deckCount: o.deck.length, turnCount: o.turnCount,
  };

  return {
    id: state.id,
    status: state.status,
    turn: state.turn,
    activePlayer: state.activePlayer,
    pendingAttack: state.pendingAttack,
    winner: state.winner,
    you: self,
    opponent,
    yourTurn: state.activePlayer === viewer && !state.pendingAttack,
    log: state.log.slice(-30),
    legal: legalActions(state, viewer),
  };
}

// --- Utilitaires -------------------------------------------------------------
function assertPlaying(state) {
  if (state.status !== 'playing') throw gameError('La partie est terminée.');
}

function gameError(message) {
  const err = new Error(message);
  err.isGameError = true;
  return err;
}
