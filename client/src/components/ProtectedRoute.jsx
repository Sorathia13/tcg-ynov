import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Protège les routes nécessitant une authentification.
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
