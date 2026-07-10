// Plateau de bataille : affiche l'état de la partie et gère les interactions
// (déploiement, attaque, garde) selon les coups légaux fournis par le serveur.
import { useState, useEffect } from 'react';
import Card from './Card.jsx';

const frSide = (s) => (s === 'pile' ? 'Pile' : 'Face');

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
  const [replacing, setReplacing] = useState(null); // iid de la carte en attente de placement (champ plein)

  // Lancer de pièce animé, joué une seule fois au démarrage de chaque partie.
  const [flipStage, setFlipStage] = useState('spinning'); // spinning | result | done
  const gameId = view?.id;
  useEffect(() => {
    if (!view?.coin) return;
    setFlipStage('spinning');
    const t1 = setTimeout(() => setFlipStage('result'), 1600);
    const t2 = setTimeout(() => setFlipStage('done'), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [gameId]);

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

  const handleForfeit = () => {
    if (confirm('Abandonner la partie et revenir au salon ?')) game.forfeit();
  };

  // Placement d'une unité : sur emplacement libre, ou par-dessus une unité si le champ est plein.
  const replaceMode = replacing && yourTurn && !mustGuard;
  const onHandDeploy = (c) => {
    if (legal?.fieldFull) setReplacing((cur) => (cur === c.iid ? null : c.iid));
    else actions.deploy([c.iid]);
  };
  const onFieldClick = (u) => {
    if (replaceMode) { actions.deploy([replacing], u.iid); setReplacing(null); }
    else if (yourTurn && attackers.has(u.iid)) actions.attack(u.iid);
  };

  return (
    <section className="board">
      {/* Lancer de pièce automatique au début de partie */}
      {view.coin && flipStage !== 'done' && (
        <div className="coin-overlay">
          <div className={`coin ${flipStage === 'spinning' ? 'spinning' : `landed-${view.coin}`}`}>
            {flipStage === 'spinning' ? '🪙' : frSide(view.coin)[0]}
          </div>
          {flipStage === 'spinning' ? (
            <h2>Pile ou face…</h2>
          ) : (
            <>
              <h2 className="coin-result">{frSide(view.coin)} !</h2>
              <p className="coin-assign">{view.youStarted ? '🎉 Vous commencez' : `${view.opponent.name} commence`}</p>
            </>
          )}
        </div>
      )}

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

        {view.coin && (
          <div className="coin-badge">
            🪙 {view.coin === 'pile' ? 'Pile' : 'Face'} — {view.youStarted ? 'vous avez commencé' : `${view.opponent.name} a commencé`}
          </div>
        )}

        {yourTurn && !finished && legal && (
          <div className="turn-info">
            Palier : <b>Grade {legal.maxGrade}</b> — vous pouvez déployer les grades 0 à {legal.maxGrade}
            {legal.canAttack === false && <span className="no-attack"> · pas d'attaque à votre 1<sup>er</sup> tour</span>}
          </div>
        )}

        {view.pendingAttack && !finished && (
          <div className="attack-banner">
            Attaque : <b>{view.pendingAttack.name}</b> — puissance {view.pendingAttack.power}, critique {view.pendingAttack.critical}
          </div>
        )}

        <ul className="log">
          {view.log.slice(-6).map((l, i) => <li key={i} className={`log-${l.type}`}>{l.message}</li>)}
        </ul>
        {error && <p className="error small">{error}</p>}
        {!finished && (
          <button className="btn ghost danger small-btn" onClick={handleForfeit}>🏳 Abandonner</button>
        )}
      </div>

      {/* Vous */}
      <div className="board-zone you">
        {replaceMode && (
          <div className="attack-banner">
            ♻ Cliquez l'une de vos unités pour la remplacer (elle sera retirée).
            <button className="btn ghost small-btn" onClick={() => setReplacing(null)}>Annuler</button>
          </div>
        )}
        <div className="field">
          {you.field.length === 0 && <span className="empty-field">— déployez des unités depuis votre main —</span>}
          {you.field.map((c) => {
            const attackable = yourTurn && attackers.has(c.iid);
            const clickable = replaceMode || attackable;
            return (
              <Card key={c.iid} card={c}
                compact
                onClick={clickable ? () => onFieldClick(c) : undefined}
                disabled={!clickable}
                footer={
                  replaceMode ? <span className="add-hint">♻ Remplacer ici</span>
                  : attackable ? <span className="add-hint">⚔ Attaquer</span>
                  : null
                }
              />
            );
          })}
        </div>

        <div className="zone-header">
          <LifeBar label={you.name} life={you.life} />
          <span className="hand-count">🂠 {you.hand.length} en main · deck {you.deckCount}</span>
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
                  selected={(guarding && guardSel.includes(c.iid)) || replacing === c.iid}
                  onClick={
                    guarding ? () => toggleGuard(c.iid)
                    : canDeploy ? () => onHandDeploy(c)
                    : undefined
                  }
                  disabled={!guarding && !canDeploy}
                  footer={
                    guarding ? <span className="add-hint">🛡 {guardSel.includes(c.iid) ? 'Retirer' : 'Garder'}</span>
                    : canDeploy ? <span className="add-hint">{legal?.fieldFull ? '♻ Remplacer…' : '➕ Déployer'}</span>
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
