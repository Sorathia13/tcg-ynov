// ============================================================================
//  Service IA — l'adversaire est piloté par un LLM local via Ollama.
//  On envoie au modèle une vue compacte de la partie + les coups LÉGAUX, et on
//  lui impose une sortie JSON stricte. La réponse est validée contre les coups
//  réellement disponibles. Un moteur heuristique sert de filet de sécurité si
//  le LLM est injoignable ou renvoie une réponse inexploitable (jamais bloquant).
// ============================================================================
import { config } from '../config/env.js';

const FIELD_SIZE = 3;

// ---------------------------------------------------------------------------
//  Appel bas niveau à Ollama (/api/chat, format JSON forcé)
// ---------------------------------------------------------------------------
async function ollamaChatJSON(system, user) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ollama.timeoutMs);
  try {
    const res = await fetch(`${config.ollama.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.ollama.model,
        stream: false,
        format: 'json', // Ollama garantit une sortie JSON valide.
        options: { temperature: 0.4 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const content = data?.message?.content;
    if (!content) throw new Error('Réponse Ollama vide');
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
//  Décision : tour actif (déploiement + attaques)
// ---------------------------------------------------------------------------
export async function decideTurn(view) {
  const deployable = view.legal.deployable || [];
  const attackers = view.legal.attackers || [];
  const slots = FIELD_SIZE - view.you.field.length;

  const system = [
    'Tu es un joueur expert d\'un jeu de cartes au tour par tour (style Vanguard).',
    'But : réduire les points de vie de l\'adversaire à 0.',
    'À ton tour : tu peux DÉPLOYER des unités de ta main sur ton champ (max 3 unités),',
    'puis ATTAQUER le joueur adverse avec tes unités. Une unité qui a une "power"',
    'élevée passe plus facilement la garde ; "critical" = dégâts infligés si l\'attaque passe.',
    'Réponds UNIQUEMENT par un JSON de la forme :',
    '{"deploy": ["<iid>", ...], "attacks": ["<iid>", ...], "reasoning": "<courte explication>"}',
    'N\'utilise QUE des iid présents dans les listes fournies. Les unités déployées peuvent',
    'attaquer le même tour : inclus-les alors aussi dans "attacks".',
  ].join('\n');

  const user = JSON.stringify({
    yourLife: view.you.life,
    opponentLife: view.opponent.life,
    turn: view.you.turnCount,
    freeFieldSlots: slots,
    deployableFromHand: deployable.map(brief),
    yourUntappedUnitsOnField: attackers.map(brief),
    opponentFieldSize: view.opponent.field.length,
  });

  try {
    const out = await ollamaChatJSON(system, user);
    const deploySet = new Set(deployable.map((c) => c.iid));
    const deploy = uniq(asArray(out.deploy)).filter((iid) => deploySet.has(iid)).slice(0, Math.max(0, slots));

    const canAttack = view.legal.canAttack !== false;
    const attackSet = new Set([...attackers.map((c) => c.iid), ...deploy]);
    const attacks = canAttack ? uniq(asArray(out.attacks)).filter((iid) => attackSet.has(iid)) : [];

    // Si le LLM ne propose aucune action exploitable, on complète par l'heuristique.
    if (deploy.length === 0 && attacks.length === 0) return heuristicTurn(view);
    return { deploy, attacks, source: 'ollama' };
  } catch (err) {
    console.warn('[AI] repli heuristique (tour) :', err.message);
    return heuristicTurn(view);
  }
}

// ---------------------------------------------------------------------------
//  Décision : défense (garde)
// ---------------------------------------------------------------------------
export async function decideGuard(view) {
  const atk = view.legal.incomingAttack;
  const hand = view.legal.guardHand || [];
  if (!atk) return { guardIids: [] };

  const system = [
    'Tu défends dans un jeu de cartes. Une unité adverse t\'attaque.',
    'Tu peux DÉFAUSSER des cartes de ta main pour former un "bouclier" =',
    'somme de leurs "power". Si bouclier >= power de l\'attaquant, l\'attaque est BLOQUÉE.',
    'Sinon tu perds "critical" points de vie. Défausser coûte des cartes : ne garde que',
    'si l\'enjeu le justifie (attaque forte, ou tes PV sont bas).',
    'Réponds UNIQUEMENT par un JSON : {"guardIids": ["<iid>", ...], "reasoning": "<court>"}',
    'N\'utilise QUE des iid de ta main fournie.',
  ].join('\n');

  const user = JSON.stringify({
    yourLife: view.you.life,
    incomingAttack: { power: atk.power, criticalDamage: atk.critical },
    yourHand: hand.map(brief),
  });

  try {
    const out = await ollamaChatJSON(system, user);
    const handSet = new Set(hand.map((c) => c.iid));
    const guardIids = uniq(asArray(out.guardIids)).filter((iid) => handSet.has(iid));
    return { guardIids, source: 'ollama' };
  } catch (err) {
    console.warn('[AI] repli heuristique (garde) :', err.message);
    return heuristicGuard(view);
  }
}

// ===========================================================================
//  Filet de sécurité — heuristiques déterministes
// ===========================================================================
function heuristicTurn(view) {
  const deployable = [...(view.legal.deployable || [])].sort((a, b) => b.power - a.power);
  const slots = FIELD_SIZE - view.you.field.length;
  const canAttack = view.legal.canAttack !== false;
  // Si on ne peut pas attaquer ce tour (1er tour du joueur qui commence), ne pas déployer :
  // on garde les emplacements libres pour des unités de grade supérieur au tour suivant.
  const deploy = canAttack ? deployable.slice(0, Math.max(0, slots)).map((c) => c.iid) : [];
  const attacks = canAttack
    ? [...(view.legal.attackers || []).map((c) => c.iid), ...deploy] // les unités déployées attaquent aussi
    : [];
  return { deploy, attacks, source: 'heuristic' };
}

function heuristicGuard(view) {
  const atk = view.legal.incomingAttack;
  const hand = [...(view.legal.guardHand || [])];
  if (!atk) return { guardIids: [] };

  const lethal = atk.critical >= view.you.life;
  const block = minimalGuard(hand, atk.power);

  if (lethal) {
    // Bloquer coûte que coûte si possible ; sinon inutile de gaspiller des cartes.
    return { guardIids: block ? block.map((c) => c.iid) : [], source: 'heuristic' };
  }
  // Non létal : bloquer seulement si on est bas en PV et que c'est peu coûteux.
  if (view.you.life - atk.critical <= 4 && block && block.length <= 2) {
    return { guardIids: block.map((c) => c.iid), source: 'heuristic' };
  }
  return { guardIids: [], source: 'heuristic' };
}

// Plus petit sous-ensemble de cartes dont la somme des power dépasse `power`.
function minimalGuard(hand, power) {
  const sorted = [...hand].sort((a, b) => b.power - a.power);
  const chosen = [];
  let sum = 0;
  for (const c of sorted) {
    if (sum > power) break;
    chosen.push(c);
    sum += c.power;
  }
  return sum > power ? chosen : null;
}

// ---------------------------------------------------------------------------
//  Utilitaires
// ---------------------------------------------------------------------------
function brief(c) {
  return { iid: c.iid, name: c.name, grade: c.grade, power: c.power, critical: c.critical };
}
function asArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }
function uniq(arr) { return [...new Set(arr)]; }
