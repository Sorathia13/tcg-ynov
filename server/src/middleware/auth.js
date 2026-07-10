// Middleware d'authentification JWT (activité 5, point 2).
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { ApiError } from './errorHandler.js';

// Vérifie l'en-tête Authorization: Bearer <token> et injecte req.user.
export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'Token manquant ou mal formé'));
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { id: payload.sub, pseudo: payload.pseudo, email: payload.email, role: payload.role || 'user' };
    next();
  } catch {
    next(new ApiError(401, 'Token invalide ou expiré'));
  }
}

// Restreint l'accès à un ou plusieurs rôles (à placer après requireAuth).
export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new ApiError(401, 'Authentification requise'));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Accès réservé : privilèges insuffisants'));
    }
    next();
  };
}

// Vérifie un token brut (utilisé par le handshake Socket.io). Renvoie le payload ou null.
export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch {
    return null;
  }
}
