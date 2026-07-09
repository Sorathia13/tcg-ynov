import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'alice@tcg.dev', password: 'password123' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(form);
      navigate('/play');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-box">
      <h2>Connexion</h2>
      <form onSubmit={submit}>
        <label>Email
          <input type="email" value={form.email} required
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Mot de passe
          <input type="password" value={form.password} required
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={loading}>{loading ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <p className="muted">Pas de compte ? <Link to="/register">Créer un compte</Link></p>
      <p className="hint">Comptes de test : <code>alice@tcg.dev</code> / <code>bob@tcg.dev</code> — <code>password123</code></p>
    </div>
  );
}
