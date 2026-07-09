// Point d'entrée : monte le serveur HTTP (Express) + le serveur temps réel (Socket.io).
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config/env.js';
import { createApp } from './app.js';
import { registerGameSocket } from './socket/game.socket.js';

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: config.clientOrigin, methods: ['GET', 'POST'] },
});
registerGameSocket(io);

httpServer.listen(config.port, () => {
  console.log(`🚀 API + WebSocket sur http://localhost:${config.port}`);
  console.log(`   Front autorisé (CORS) : ${config.clientOrigin}`);
  console.log(`   IA (Ollama) : ${config.ollama.url} — modèle ${config.ollama.model}`);
});
