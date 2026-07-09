import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deckApi } from '../api/deck.api.js';

export default function Decks() {
  const [state, setState] = useState({ status: 'loading', data: [], error: null });

  const load = () => {
    setState((s) => ({ ...s, status: 'loading' }));
    deckApi.list()
      .then((data) => setState({ status: 'success', data, error: null }))
      .catch((err) => setState({ status: 'error', data: [], error: err.message }));
  };

  useEffect(load, []);

  const remove = async (id) => {
    if (!confirm('Supprimer ce deck ?')) return;
    try {
      await deckApi.remove(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const countCards = (deck) => deck.deckCards.reduce((s, dc) => s + dc.quantity, 0);

  return (
    <section>
      <div className="section-head">
        <h2>Mes decks</h2>
        <Link to="/decks/new" className="btn">+ Nouveau deck</Link>
      </div>

      {state.status === 'loading' && <p className="muted">Chargement…</p>}
      {state.status === 'error' && <p className="error">{state.error}</p>}
      {state.status === 'success' && state.data.length === 0 && (
        <p className="muted">Aucun deck. Créez-en un pour pouvoir jouer !</p>
      )}

      <div className="deck-list">
        {state.data.map((deck) => (
          <div key={deck.id} className="deck-row">
            <div>
              <h3>{deck.name}</h3>
              <span className="muted">{countCards(deck)} cartes · {deck.deckCards.length} types</span>
            </div>
            <div className="deck-actions">
              <Link to={`/decks/${deck.id}/edit`} className="btn ghost">Modifier</Link>
              <button className="btn danger" onClick={() => remove(deck.id)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
