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
// Sécurité : on n'expose jamais le détail interne d'une erreur 5xx au client
// (ex. message d'erreur Prisma) — il est seulement journalisé côté serveur.
export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error('[ERROR]', err);
    return res.status(status).json({ error: 'Erreur serveur interne' });
  }
  res.status(status).json({ error: err.message || 'Requête invalide' });
}
