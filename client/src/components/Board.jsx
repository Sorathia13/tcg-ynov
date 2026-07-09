// Plateau de bataille : affiche l'état de la partie et gère les interactions
// (déploiement, attaque, garde) selon les coups légaux fournis par le serveur.
import { useState } from 'react';
import Card from './Card.jsx';

function LifeBar({ label, life, isAI }) {
  const pct = Math.max(0, Math.min(100, (life / 15) * 100));
  return (
    <div className="lifebar">
      <span className="life-label">{isAI ? '🤖 ' : '👤 '}{label}</span>
      <div className="life-track"><div className="life-fill" style={{ width: `${pct}%` }} /></div>
      <span className="life-value">{life} PV</span>
    </div>
  );
}

export default function Board({ game }) {
  const { view, actions, result, reset, error } = game;
  const [guardSel, setGuardSel] = useState([]);

  if (!view) return <p className="muted">Chargement de la partie…</p>;

  const { you, opponent, legal } = view;
  const yourTurn = view.yourTurn;
  const mustGuard = legal?.mustGuard;
  const deployable = new Set((legal?.deployable || []).map((c) => c.iid));
  const attackers = new Set((legal?.attackers || []).map((c) => c.iid));

  const toggleGuard = (iid) => {
    setGuardSel((sel) => sel.includes(iid) ? sel.filter((x) => x !== iid) : [...sel, iid]);
  };
  const shieldSum = you.hand.filter((c) => guardSel.includes(c.iid)).reduce((s, c) => s + c.power, 0);

  const confirmGuard = () => { actions.guard(guardSel); setGuardSel([]); };
  const noGuard = () => { actions.guard([]); setGuardSel([]); };

  const finished = view.status === 'finished';
  const youWon = finished && view.winner === you.side;

  return (
    <section className="board">
      {/* Adversaire */}
      <div className="board-zone opponent">
        <div className="zone-header">
          <LifeBar label={opponent.name} life={opponent.life} isAI={opponent.isAI} />
          <span className="hand-count">🂠 {opponent.handCount} en main · deck {opponent.deckCount}</span>
        </div>
        <div className="field">
          {opponent.field.length === 0 && <span className="empty-field">— aucune unité —</span>}
          {opponent.field.map((c) => <Card key={c.iid} card={c} compact />)}
        </div>
      </div>

      {/* Centre : statut + journal */}
      <div className="board-center">
        <div className="turn-indicator">
          {finished ? (
            <span className={youWon ? 'win' : 'lose'}>{youWon ? '🏆 Victoire !' : '💀 Défaite'}</span>
          ) : mustGuard ? (
            <span className="alert">⚠ On vous attaque — défendez-vous !</span>
          ) : yourTurn ? (
            <span className="your-turn">▶ À vous de jouer (tour {you.turnCount})</span>
          ) : (
            <span className="wait-turn">⏳ Tour de l'adversaire…</span>
          )}
        </div>

        {view.pendingAttack && !finished && (
          <div className="attack-banner">
            Attaque : <b>{view.pendingAttack.name}</b> — puissance {view.pendingAttack.power}, critique {view.pendingAttack.critical}
          </div>
        )}

        <ul className="log">
          {view.log.slice(-6).map((l, i) => <li key={i} className={`log-${l.type}`}>{l.message}</li>)}
        </ul>
        {error && <p className="error small">{error}</p>}
      </div>

      {/* Vous */}
      <div className="board-zone you">
        <div className="field">
          {you.field.length === 0 && <span className="empty-field">— déployez des unités depuis votre main —</span>}
          {you.field.map((c) => (
            <Card key={c.iid} card={c}
              compact
              onClick={yourTurn && attackers.has(c.iid) ? () => actions.attack(c.iid) : undefined}
              disabled={!yourTurn || !attackers.has(c.iid)}
              footer={yourTurn && attackers.has(c.iid) ? <span className="add-hint">⚔ Attaquer</span> : null}
            />
          ))}
        </div>

        <div className="zone-header">
          <LifeBar label={you.name} life={you.life} />
        </div>

        {/* Main */}
        <div className="hand">
          <h4>Votre main ({you.hand.length})</h4>
          <div className="hand-cards">
            {you.hand.map((c) => {
              const canDeploy = yourTurn && !mustGuard && deployable.has(c.iid);
              const guarding = mustGuard;
              return (
                <Card key={c.iid} card={c}
                  compact
                  selected={guarding && guardSel.includes(c.iid)}
                  onClick={
                    guarding ? () => toggleGuard(c.iid)
                    : canDeploy ? () => actions.deploy([c.iid])
                    : undefined
                  }
                  disabled={!guarding && !canDeploy}
                  footer={
                    guarding ? <span className="add-hint">🛡 {guardSel.includes(c.iid) ? 'Retirer' : 'Garder'}</span>
                    : canDeploy ? <span className="add-hint">➕ Déployer</span>
                    : null
                  }
                />
              );
            })}
          </div>
        </div>

        {/* Contrôles */}
        <div className="controls">
          {mustGuard && (
            <div className="guard-controls">
              <span>Bouclier sélectionné : <b>{shieldSum}</b> / attaque {view.pendingAttack?.power}
                {shieldSum > (view.pendingAttack?.power || 0) ? ' ✔ bloque' : ' ✘ insuffisant'}</span>
              <button className="btn" onClick={confirmGuard} disabled={guardSel.length === 0}>🛡 Garder</button>
              <button className="btn ghost" onClick={noGuard}>Encaisser l'attaque</button>
            </div>
          )}
          {!mustGuard && yourTurn && !finished && (
            <button className="btn" onClick={actions.endTurn}>Terminer le tour →</button>
          )}
          {finished && (
            <button className="btn big" onClick={reset}>◀ Retour au salon</button>
          )}
        </div>
      </div>
    </section>
  );
}
