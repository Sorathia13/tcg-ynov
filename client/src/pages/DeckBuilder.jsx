import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { cardApi } from '../api/card.api.js';
import { deckApi } from '../api/deck.api.js';
import Card from '../components/Card.jsx';

const RULES = { min: 16, max: 50, maxCopies: 4 };

export default function DeckBuilder() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [selection, setSelection] = useState({}); // cardId -> { card, quantity }
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cards = await cardApi.list({ page: 1, limit: 100 });
        setCatalog(cards.data);
        if (editing) {
          const deck = await deckApi.getById(id);
          setName(deck.name);
          const sel = {};
          for (const dc of deck.deckCards) sel[dc.card.id] = { card: dc.card, quantity: dc.quantity };
          setSelection(sel);
        }
        setStatus('ready');
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    })();
  }, [id, editing]);

  const total = useMemo(
    () => Object.values(selection).reduce((s, e) => s + e.quantity, 0),
    [selection],
  );

  const add = (card) => {
    setSelection((prev) => {
      const cur = prev[card.id]?.quantity || 0;
      if (cur >= RULES.maxCopies) return prev;
      return { ...prev, [card.id]: { card, quantity: cur + 1 } };
    });
  };

  const removeOne = (cardId) => {
    setSelection((prev) => {
      const cur = prev[cardId]?.quantity || 0;
      if (cur <= 1) {
        const copy = { ...prev };
        delete copy[cardId];
        return copy;
      }
      return { ...prev, [cardId]: { ...prev[cardId], quantity: cur - 1 } };
    });
  };

  const valid = name.trim() && total >= RULES.min && total <= RULES.max;

  const save = async () => {
    setError(null);
    if (!valid) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      cards: Object.values(selection).map((e) => ({ cardId: e.card.id, quantity: e.quantity })),
    };
    try {
      if (editing) await deckApi.update(id, payload);
      else await deckApi.create(payload);
      navigate('/decks');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading') return <p className="muted">Chargement…</p>;
  if (status === 'error') return <p className="error">{error}</p>;

  return (
    <section className="builder">
      <div className="section-head">
        <h2>{editing ? 'Modifier le deck' : 'Nouveau deck'}</h2>
        <input
          className="deck-name"
          placeholder="Nom du deck"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="builder-layout">
        <div className="builder-catalog">
          <h3>Catalogue</h3>
          <div className="card-grid small">
            {catalog.map((c) => (
              <Card
                key={c.id}
                card={c}
                compact
                onClick={() => add(c)}
                footer={<span className="add-hint">+ Ajouter ({selection[c.id]?.quantity || 0}/{RULES.maxCopies})</span>}
                disabled={(selection[c.id]?.quantity || 0) >= RULES.maxCopies}
              />
            ))}
          </div>
        </div>

        <aside className="builder-side">
          <h3>Composition ({total}/{RULES.max})</h3>
          <p className={`deck-count ${valid ? 'ok' : 'warn'}`}>
            {total < RULES.min
              ? `Ajoutez encore ${RULES.min - total} carte(s) (min. ${RULES.min})`
              : total > RULES.max
                ? `Trop de cartes (max. ${RULES.max})`
                : 'Deck valide ✔'}
          </p>
          <ul className="selection-list">
            {Object.values(selection).sort((a, b) => a.card.grade - b.card.grade).map(({ card, quantity }) => (
              <li key={card.id}>
                <span>G{card.grade} · {card.name}</span>
                <span className="qty-controls">
                  <button onClick={() => removeOne(card.id)}>−</button>
                  <b>{quantity}</b>
                  <button onClick={() => add(card)} disabled={quantity >= RULES.maxCopies}>+</button>
                </span>
              </li>
            ))}
            {total === 0 && <li className="muted">Cliquez sur des cartes pour les ajouter.</li>}
          </ul>
          {error && <p className="error">{error}</p>}
          <button className="btn" disabled={!valid || saving} onClick={save}>
            {saving ? 'Enregistrement…' : (editing ? 'Enregistrer' : 'Créer le deck')}
          </button>
        </aside>
      </div>
    </section>
  );
}
