// Playtest automatisé (Monte Carlo) au niveau du MOTEUR de jeu.
// Joue N parties completes avec une politique deterministe des deux cotes et agrege
// des metriques quantitatives : stabilite (0 exception), duree (tours), equilibrage.
//
// Usage : npm run simulate        (500 parties par defaut)
//         node scripts/simulate.mjs 1000
import * as engine from '../src/services/game.engine.js';

const N = Number(process.argv[2] || 500);

// Deck representatif du deck de depart (puissances standardisees par grade).
function starterDeck() {
  const C = (id, grade, power, critical, qty) => ({ quantity: qty, card: { id, name: `c${id}`, grade, power, critical, type: 'T', description: '' } });
  return [
    C(1, 0, 6000, 1, 4), C(2, 0, 6000, 1, 4), C(3, 0, 6000, 1, 2),        // G0 x10
    C(4, 1, 8000, 1, 3), C(5, 1, 8000, 1, 2), C(6, 1, 8000, 1, 2),        // G1 x7
    C(7, 2, 10000, 1, 3), C(8, 2, 10000, 2, 2), C(9, 2, 10000, 1, 2),     // G2 x7
    C(10, 3, 13000, 2, 2), C(11, 3, 13000, 1, 1), C(12, 3, 13000, 3, 1),  // G3 x4
  ];
}

// Garde heuristique (comme ai.service) : bloque le letal si possible, sinon economise.
function chooseGuard(state, side, atk) {
  const hand = state.players[side].hand;
  const life = state.players[side].life;
  const sorted = [...hand].sort((a, b) => b.power - a.power);
  let chosen = [], sum = 0;
  for (const c of sorted) { if (sum > atk.power) break; chosen.push(c); sum += c.power; }
  const block = sum > atk.power ? chosen : null;
  if (atk.critical >= life) return block ? block.map((c) => c.iid) : [];
  if (life - atk.critical <= 4 && block && block.length <= 2) return block.map((c) => c.iid);
  return [];
}

function playTurn(state, side) {
  const bestFirst = (arr) => [...arr].sort((a, b) => b.power - a.power);
  let slots = engine.RULES.FIELD_SIZE - state.players[side].field.length;
  for (const c of bestFirst(engine.legalActions(state, side).deployable || [])) {
    if (slots <= 0) break;
    try { engine.deploy(state, side, [c.iid]); slots--; } catch { /* skip */ }
  }
  let up = 0;
  while (state.players[side].field.length >= engine.RULES.FIELD_SIZE && up++ < 3) {
    const playable = bestFirst(engine.legalActions(state, side).deployable || []);
    if (!playable.length) break;
    const best = playable[0];
    const weakest = state.players[side].field.reduce((a, b) => (b.power < a.power ? b : a));
    if (best.power <= weakest.power) break;
    try { engine.deploy(state, side, [best.iid], weakest.iid); } catch { break; }
  }
  const la = engine.legalActions(state, side);
  if (la.canAttack) {
    for (const u of (la.attackers || [])) {
      if (state.status !== 'playing') break;
      try {
        engine.declareAttack(state, side, u.iid);
        const def = engine.opponentOf(side);
        engine.resolveGuard(state, def, chooseGuard(state, def, state.pendingAttack));
      } catch { /* skip */ }
    }
  }
  if (state.status === 'playing') engine.endTurn(state, side);
}

const results = [];
let exceptions = 0, unfinished = 0, starterWins = 0;

for (let i = 0; i < N; i++) {
  try {
    const s = engine.createGameState({
      id: i + 1,
      playerA: { userId: 1, name: 'A', isAI: false, deckCards: starterDeck() },
      playerB: { userId: 2, name: 'B', isAI: false, deckCards: starterDeck() },
      seed: (i + 1) * 2654435761,
    });
    const starter = s.starter;
    let safety = 0;
    while (s.status === 'playing' && safety++ < 400) playTurn(s, s.activePlayer);
    if (s.status !== 'finished') { unfinished++; continue; }
    if (s.winner === starter) starterWins++;
    results.push({ turns: s.turn, margin: Math.abs(s.players.A.life - s.players.B.life) });
  } catch (e) {
    exceptions++;
    if (exceptions <= 3) console.error('exception:', e.message);
  }
}

const done = results.length;
const turns = results.map((r) => r.turns).sort((a, b) => a - b);
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

console.log(JSON.stringify({
  parties: N,
  terminees: done,
  exceptions,
  inachevees: unfinished,
  tauxCompletion: `${Math.round((done / N) * 100)}%`,
  toursMoyen: +avg(turns).toFixed(1),
  toursMedian: turns[Math.floor(turns.length / 2)] || 0,
  toursMin: turns[0] || 0,
  toursMax: turns[turns.length - 1] || 0,
  victoiresPremierJoueur: done ? `${Math.round((starterWins / done) * 100)}%` : 'n/a',
  margeVieMoyenne: +avg(results.map((r) => r.margin)).toFixed(1),
}, null, 2));
