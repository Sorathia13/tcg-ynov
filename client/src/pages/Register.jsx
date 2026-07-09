import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ pseudo: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      navigate('/play');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-box">
      <h2>Créer un compte</h2>
      <form onSubmit={submit}>
        <label>Pseudo
          <input value={form.pseudo} required minLength={2}
            onChange={(e) => setForm({ ...form, pseudo: e.target.value })} />
        </label>
        <label>Email
          <input type="email" value={form.email} required
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Mot de passe (min. 6 caractères)
          <input type="password" value={form.password} required minLength={6}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={loading}>{loading ? 'Création…' : 'Créer mon compte'}</button>
      </form>
      <p className="muted">Déjà inscrit ? <Link to="/login">Se connecter</Link></p>
    </div>
  );
}
