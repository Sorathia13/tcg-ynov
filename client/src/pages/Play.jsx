import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deckApi } from '../api/deck.api.js';
import { useGameSocket } from '../hooks/useGameSocket.js';
import Board from '../components/Board.jsx';

export default function Play() {
  const [decks, setDecks] = useState(null);
  const [deckId, setDeckId] = useState('');
  const [loadError, setLoadError] = useState(null);
  const game = useGameSocket();

  useEffect(() => {
    deckApi.list()
      .then((data) => {
        setDecks(data);
        if (data.length) setDeckId(String(data[0].id));
      })
      .catch((err) => setLoadError(err.message));
  }, []);

  // --- Lobby ---
  if (game.phase === 'idle' || game.phase === 'connecting' || game.phase === 'waiting' || game.phase === 'error') {
    return (
      <section className="lobby">
        <h2>Salon de jeu</h2>

        {loadError && <p className="error">{loadError}</p>}
        {decks === null && <p className="muted">Chargement de vos decks…</p>}
        {decks && decks.length === 0 && (
          <p className="muted">
            Vous n'avez aucun deck. <Link to="/decks/new">Créez-en un</Link> pour pouvoir jouer.
          </p>
        )}

        {decks && decks.length > 0 && (
          <>
            <label className="deck-select">
              Deck utilisé :
              <select value={deckId} onChange={(e) => setDeckId(e.target.value)}>
                {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>

            <div className="lobby-actions">
              <button className="btn big" disabled={game.phase === 'connecting'}
                onClick={() => game.startVsAI(Number(deckId))}>
                🤖 Jouer contre l'IA
              </button>
              <button className="btn big ghost" disabled={game.phase !== 'idle' && game.phase !== 'error'}
                onClick={() => game.joinQueue(Number(deckId))}>
                🆚 Chercher un adversaire (PvP)
              </button>
            </div>
          </>
        )}

        {game.phase === 'connecting' && <p className="muted">Initialisation de la partie…</p>}
        {game.phase === 'waiting' && (
          <div className="waiting">
            <p className="muted">{game.info || 'Recherche d\'un adversaire…'}</p>
            <button className="btn ghost" onClick={game.leaveQueue}>Annuler</button>
          </div>
        )}
        {game.error && <p className="error">{game.error}</p>}
      </section>
    );
  }

  // --- Partie en cours / terminée ---
  return <Board game={game} />;
}
