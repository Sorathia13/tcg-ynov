import { useEffect, useState } from 'react';
import { cardApi } from '../api/card.api.js';
import Card from '../components/Card.jsx';

export default function Cards() {
  const [state, setState] = useState({ status: 'loading', data: [], error: null });
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ totalPages: 1, total: 0 });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    cardApi.list({ page, limit: 24, search, grade })
      .then((res) => {
        if (cancelled) return;
        setState({ status: 'success', data: res.data, error: null });
        setMeta({ totalPages: res.totalPages, total: res.total });
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', data: [], error: err.message });
      });
    return () => { cancelled = true; };
  }, [page, search, grade]);

  return (
    <section>
      <h2>Catalogue des cartes</h2>
      <div className="filters">
        <input
          placeholder="Rechercher une carte…"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value); }}
        />
        <select value={grade} onChange={(e) => { setPage(1); setGrade(e.target.value); }}>
          <option value="">Tous les grades</option>
          <option value="0">Grade 0</option>
          <option value="1">Grade 1</option>
          <option value="2">Grade 2</option>
          <option value="3">Grade 3</option>
        </select>
      </div>

      {state.status === 'loading' && <p className="muted">Chargement des cartes…</p>}
      {state.status === 'error' && <p className="error">{state.error}</p>}
      {state.status === 'success' && state.data.length === 0 && (
        <p className="muted">Aucune carte ne correspond.</p>
      )}

      <div className="card-grid">
        {state.data.map((c) => <Card key={c.id} card={c} />)}
      </div>

      {meta.totalPages > 1 && (
        <div className="pagination">
          <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Précédent</button>
          <span>Page {page} / {meta.totalPages} ({meta.total} cartes)</span>
          <button className="btn ghost" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Suivant →</button>
        </div>
      )}
    </section>
  );
}
