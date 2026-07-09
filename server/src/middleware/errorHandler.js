// Gestion centralisée des erreurs (bonus activité 3 : contrôles d'erreurs 404 / 500).

// Erreur applicative avec code HTTP explicite.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// 404 pour toute route non trouvée.
export function notFound(req, res, next) {
  next(new ApiError(404, `Route introuvable : ${req.method} ${req.originalUrl}`));
}

// Handler final : formate proprement toute erreur en JSON.
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({
    error: err.message || 'Erreur serveur interne',
  });
}
