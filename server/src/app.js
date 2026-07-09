// Configuration de l'application Express (middlewares, routes REST, gestion d'erreurs).
import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import cardRoutes from './routes/card.routes.js';
import deckRoutes from './routes/deck.routes.js';
import gameRoutes from './routes/game.routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json());

  // Healthcheck simple.
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'tcg-ynov-api' }));

  // Routes REST.
  app.use('/api/auth', authRoutes);
  app.use('/api/cards', cardRoutes);
  app.use('/api/decks', deckRoutes);
  app.use('/api/games', gameRoutes);

  // 404 + gestion centralisée des erreurs (toujours en dernier).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
