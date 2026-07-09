import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <Link to="/" className="brand">🃏 TCG Ynov</Link>
      <div className="nav-links">
        <NavLink to="/cards">Cartes</NavLink>
        {user && <NavLink to="/decks">Mes decks</NavLink>}
        {user && <NavLink to="/play">Jouer</NavLink>}
      </div>
      <div className="nav-user">
        {user ? (
          <>
            <span className="pseudo">👤 {user.pseudo}</span>
            <button className="btn ghost" onClick={handleLogout}>Déconnexion</button>
          </>
        ) : (
          <Link to="/login" className="btn">Connexion</Link>
        )}
      </div>
    </nav>
  );
}
