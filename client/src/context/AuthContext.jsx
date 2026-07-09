// Gestion d'état de la session utilisateur (Context API — activité 6).
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/auth.api.js';
import { setToken, getToken, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Déconnexion automatique si un appel API renvoie 401 (token expiré).
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // Restaure la session au chargement si un token est présent.
  useEffect(() => {
    (async () => {
      if (getToken()) {
        try {
          setUser(await authApi.me());
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (credentials) => {
    const { user, token } = await authApi.login(credentials);
    setToken(token);
    setUser(user);
    return user;
  };

  const register = async (payload) => {
    const { user, token } = await authApi.register(payload);
    setToken(token);
    setUser(user);
    return user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
