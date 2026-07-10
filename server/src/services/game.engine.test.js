// Tests du moteur de jeu (règles TCG lite). Le moteur étant déterministe et sans
// dépendance (ni DB ni réseau), il se teste en isolation totale.
import { describe, it, expect } from 'vitest';
import {
  RULES, createGameState, deploy, declareAttack, resolveGuard, endTurn,
  legalActions, publicView, opponentOf, maxDeployableGrade,
} from './game.engine.js';

// Fabrique un deck (deckCards) : `spec` = { grade: quantité } ou liste de cartes.
function deckOf(grade, quantity = 20, power = 6000, critical = 1) {
  return [{ quantity, card: { id: grade, name: `G${grade}`, grade, power, critical, type: 'T', description: '' } }];
}

function newGame(seed = 1, deckA = deckOf(0), deckB = deckOf(0)) {
  return createGameState({
    id: 1,
    playerA: { userId: 1, name: 'A', isAI: false, deckCards: deckA },
    playerB: { userId: 2, name: 'B', isAI: false, deckCards: deckB },
    seed,
  });
}

describe('création de partie', () => {
  it('initialise 15 PV et une main de départ', () => {
    const s = newGame();
    expect(s.players.A.life).toBe(RULES.STARTING_LIFE);
    expect(s.players.B.life).toBe(RULES.STARTING_LIFE);
    // Le joueur qui commence a pioché 1 carte (5 + 1), l'autre pas encore.
    const first = s.starter, second = opponentOf(first);
    expect(s.players[first].hand.length).toBe(RULES.HAND_START + 1);
    expect(s.players[second].hand.length).toBe(RULES.HAND_START);
    expect(s.status).toBe('playing');
  });

  it('effectue un pile ou face déterministe (reproductible par graine)', () => {
    const a = newGame(42);
    const b = newGame(42);
    expect(['pile', 'face']).toContain(a.coin);
    expect(a.coin).toBe(b.coin);       // même graine → même résultat
    expect(a.starter).toBe(b.starter);
  });
});

describe('règles de tour', () => {
  it('le joueur qui commence ne peut pas attaquer à son 1er tour', () => {
    const s = newGame();
    const first = s.starter;
    s.players[first].field.push({ iid: 'u', name: 'U', grade: 0, power: 6000, critical: 1, tapped: false });
    expect(legalActions(s, first).canAttack).toBe(false);
    expect(() => declareAttack(s, first, 'u')).toThrow(/premier tour/);
  });

  it('le 2e joueur pioche une carte bonus à son 1er tour uniquement', () => {
    const s = newGame();
    const first = s.starter, second = opponentOf(first);
    const before = s.players[second].hand.length; // 5 (pas encore joué)
    endTurn(s, first);                              // le 2e joueur commence son tour
    expect(s.players[second].hand.length).toBe(before + 2); // +2 (pioche bonus)
  });

  it('la progression de grade suit le numéro de tour', () => {
    const s = newGame();
    const first = s.starter;
    expect(maxDeployableGrade(s.players[first])).toBe(0); // tour 1 → grade 0
    endTurn(s, first);
    endTurn(s, opponentOf(first));
    expect(maxDeployableGrade(s.players[first])).toBe(1); // tour 2 → grade 1
  });
});

describe('déploiement', () => {
  it('déploie une unité de grade autorisé sur un emplacement libre', () => {
    const s = newGame(1, deckOf(0));
    const first = s.starter;
    const card = s.players[first].hand[0];
    deploy(s, first, [card.iid]);
    expect(s.players[first].field).toHaveLength(1);
    expect(s.players[first].field[0].iid).toBe(card.iid);
  });

  it('refuse une unité de grade trop élevé pour le tour', () => {
    const s = newGame(1, deckOf(3, 20, 13000)); // deck de G3
    const first = s.starter;
    const card = s.players[first].hand[0];
    expect(() => deploy(s, first, [card.iid])).toThrow(/grade/);
  });

  it('refuse un ajout quand le champ est plein, mais autorise le remplacement', () => {
    const s = newGame(1, deckOf(0));
    const first = s.starter;
    const [c1, c2, c3, c4] = s.players[first].hand;
    deploy(s, first, [c1.iid, c2.iid, c3.iid]);
    expect(s.players[first].field).toHaveLength(RULES.FIELD_SIZE);
    expect(() => deploy(s, first, [c4.iid])).toThrow(/plein/);
    // Remplacement de la 1re unité
    const target = s.players[first].field[0].iid;
    deploy(s, first, [c4.iid], target);
    expect(s.players[first].field).toHaveLength(RULES.FIELD_SIZE);
    expect(s.players[first].field[0].iid).toBe(c4.iid);
  });
});

describe('combat (attaque / garde)', () => {
  // Amène A au tour 2 (peut attaquer) avec une unité connue sur le terrain.
  function setupAttack(attackerPower, attackerCrit) {
    const s = newGame();
    const first = s.starter, second = opponentOf(first);
    // On force A ('first') actif à son 2e tour.
    endTurn(s, first);
    endTurn(s, second);
    s.players[first].field.push({ iid: 'atk', name: 'ATK', grade: 2, power: attackerPower, critical: attackerCrit, tapped: false });
    return { s, atkSide: first, defSide: second };
  }

  it('inflige les dégâts (critical) si l\'attaque perce la garde', () => {
    const { s, atkSide, defSide } = setupAttack(10000, 2);
    s.players[defSide].hand = [{ iid: 'g', name: 'G', grade: 0, power: 6000, critical: 1 }];
    const lifeBefore = s.players[defSide].life;
    declareAttack(s, atkSide, 'atk');
    expect(s.pendingAttack).not.toBeNull();
    resolveGuard(s, defSide, ['g']);          // bouclier 6000 < 10000 → passe
    expect(s.players[defSide].life).toBe(lifeBefore - 2);
    expect(s.pendingAttack).toBeNull();
  });

  it('bloque l\'attaque si le bouclier est suffisant', () => {
    const { s, atkSide, defSide } = setupAttack(8000, 2);
    s.players[defSide].hand = [
      { iid: 'g1', name: 'G1', grade: 1, power: 8000, critical: 1 },
      { iid: 'g2', name: 'G2', grade: 0, power: 6000, critical: 1 },
    ];
    const lifeBefore = s.players[defSide].life;
    declareAttack(s, atkSide, 'atk');
    resolveGuard(s, defSide, ['g1', 'g2']);   // bouclier 14000 ≥ 8000 → bloqué
    expect(s.players[defSide].life).toBe(lifeBefore);
  });

  it('termine la partie quand un joueur tombe à 0 PV', () => {
    const { s, atkSide, defSide } = setupAttack(10000, 3);
    s.players[defSide].life = 2;
    s.players[defSide].hand = [];             // pas de garde possible
    declareAttack(s, atkSide, 'atk');
    resolveGuard(s, defSide, []);
    expect(s.players[defSide].life).toBe(0);
    expect(s.status).toBe('finished');
    expect(s.winner).toBe(atkSide);
  });
});

describe('vue publique', () => {
  it('masque la main et le deck de l\'adversaire', () => {
    const s = newGame();
    const view = publicView(s, 'A');
    expect(Array.isArray(view.you.hand)).toBe(true);
    expect(view.opponent.hand).toBeUndefined();
    expect(typeof view.opponent.handCount).toBe('number');
    expect(typeof view.opponent.deckCount).toBe('number');
  });
});
